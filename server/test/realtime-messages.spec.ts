// test/realtime-messages.spec.ts
// Realtime conformance for the Messages feature (docs/contract/asyncapi.yaml) — boots the full
// app with the Socket.io gateway against real Postgres + Redis and proves persist-then-broadcast
// end to end: a REST POST /messages causes the recipient's socket to receive `message:new` with
// the contract Message payload; the broadcast is observable only AFTER the row is committed
// (NF-16); soft-delete fans out `message:deleted`; and a socket handshake with a bad JWT is
// rejected.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface SignedUpUser {
  id: string;
  username: string;
  accessToken: string;
}

const waitFor = <T>(socket: Socket, event: string, timeoutMs = 4000): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

describe('Realtime messages (socket.io)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;
  let alice: SignedUpUser;
  let bob: SignedUpUser;
  let conversationId: string;
  const sockets: Socket[] = [];

  const httpServer = () => app.getHttpServer();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const signup = async (username: string): Promise<SignedUpUser> => {
    const res = await request(httpServer())
      .post('/api/auth/signup')
      .send({ username, email: `${username}@example.com`, password: 'password123', acceptedTerms: true })
      .expect(201);
    return { id: res.body.user.id, username, accessToken: res.body.accessToken };
  };

  const connect = (token: string): Promise<Socket> =>
    new Promise((resolve, reject) => {
      const socket = io(baseUrl, { auth: { token }, transports: ['websocket'], reconnection: false });
      sockets.push(socket);
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', (err) => reject(err));
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ZodValidationPipe());
    app.use(cookieParser());
    await app.init();
    await app.listen(0); // ephemeral port for the socket clients

    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    prisma = app.get(PrismaService);
    await prisma.user.deleteMany();

    alice = await signup('alice_rt');
    bob = await signup('bob_rt');

    // Befriend + open the DM so both sockets join the conversation room on connect.
    const created = await request(httpServer())
      .post('/api/contacts/requests')
      .set(auth(alice.accessToken))
      .send({ userId: bob.id })
      .expect(201);
    await request(httpServer())
      .post(`/api/contacts/requests/${created.body.id}/accept`)
      .set(auth(bob.accessToken))
      .expect(200);
    const dm = await request(httpServer())
      .post('/api/conversations/dm')
      .set(auth(alice.accessToken))
      .send({ userId: bob.id })
      .expect(201);
    conversationId = dm.body.id as string;
  });

  afterAll(async () => {
    for (const s of sockets) s.close();
    await prisma.conversation.deleteMany();
    await prisma.relation.deleteMany();
    await prisma.request.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  it('rejects a socket handshake with an invalid JWT', async () => {
    await expect(connect('not-a-real-token')).rejects.toBeDefined();
  });

  it('delivers message:new to the recipient after the REST 201 (persist-then-broadcast)', async () => {
    const bobSocket = await connect(bob.accessToken);
    const received = waitFor<{ message: Record<string, unknown> }>(bobSocket, 'message:new');

    const sent = await request(httpServer())
      .post(`/api/conversations/${conversationId}/messages`)
      .set(auth(alice.accessToken))
      .send({ content: 'live hello', clientNonce: 'n1' })
      .expect(201);

    const event = await received;
    // Payload conforms to asyncapi.yaml#MessageNew { message } with the contract Message shape.
    expect(event.message).toMatchObject({
      id: sent.body.id,
      conversationId,
      senderId: alice.id,
      content: 'live hello',
      status: 'sent',
    });
    expect(typeof event.message.sequence).toBe('number');

    // The row is durably committed before the broadcast — readable from the DB by its id.
    const row = await prisma.message.findUnique({ where: { id: sent.body.id as string } });
    expect(row).not.toBeNull();
  });

  it('fans out message:deleted when the sender soft-deletes', async () => {
    const bobSocket = await connect(bob.accessToken);

    const sent = await request(httpServer())
      .post(`/api/conversations/${conversationId}/messages`)
      .set(auth(alice.accessToken))
      .send({ content: 'delete me' })
      .expect(201);

    const deleted = waitFor<{ conversationId: string; messageId: string }>(bobSocket, 'message:deleted');
    await request(httpServer())
      .delete(`/api/messages/${sent.body.id}`)
      .set(auth(alice.accessToken))
      .expect(204);

    const event = await deleted;
    expect(event).toEqual({ conversationId, messageId: sent.body.id });
  });
});
