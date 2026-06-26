// test/contract-groups.spec.ts
// Contract conformance for /api/groups — boots the full app against a real Postgres and
// exercises every REST operation in docs/contract/groups.openapi.yaml: create, detail
// (membership-gated), admin profile edit + delete, member list/add/role-change/remove+leave,
// invite-link creation, and link-based join. The adopted model is direct-join (no admin
// approval), so the conditional join-request endpoints are out of scope.
//
// Users are created ONCE in beforeAll and reused; only the social/group state is reset
// between tests (the auth ThrottlerGuard is not bypassable via overrideGuard, so we keep
// signups well under the 10/min limit).
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface SignedUpUser {
  id: string;
  username: string;
  accessToken: string;
}

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

describe('Groups contract (/api/groups)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let alice: SignedUpUser; // group admin/creator
  let bob: SignedUpUser; // contact added as member
  let carol: SignedUpUser; // joins via invite link

  const server = () => app.getHttpServer();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const signup = async (username: string): Promise<SignedUpUser> => {
    const res = await request(server())
      .post('/api/auth/signup')
      .send({ username, email: `${username}@example.com`, password: 'password123', acceptedTerms: true })
      .expect(201);
    return { id: res.body.user.id, username, accessToken: res.body.accessToken };
  };

  const resetState = async () => {
    await prisma.conversation.deleteMany(); // cascades groups, members, invite links, messages
    await prisma.relation.deleteMany();
    await prisma.request.deleteMany();
  };

  const befriend = async (a: SignedUpUser, b: SignedUpUser): Promise<void> => {
    const created = await request(server())
      .post('/api/contacts/requests')
      .set(auth(a.accessToken))
      .send({ userId: b.id })
      .expect(201);
    await request(server())
      .post(`/api/contacts/requests/${created.body.id}/accept`)
      .set(auth(b.accessToken))
      .expect(200);
  };

  /** Create a group as `admin`; returns the created Group body. */
  const createGroup = async (
    admin: SignedUpUser,
    memberIds: string[] = [],
  ): Promise<{ id: string; [k: string]: unknown }> => {
    const res = await request(server())
      .post('/api/groups')
      .set(auth(admin.accessToken))
      .send({ name: 'Team', memberIds })
      .expect(201);
    return res.body;
  };

  const GROUP_KEYS = ['id', 'name', 'description', 'avatarUrl', 'createdAt', 'memberCount', 'role'];
  const GROUP_MEMBER_KEYS = ['user', 'role', 'joinedAt'];

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

    prisma = app.get(PrismaService);
    await prisma.user.deleteMany();

    alice = await signup('alice_grp');
    bob = await signup('bob_grp');
    carol = await signup('carol_grp');
  });

  beforeEach(async () => {
    await resetState();
  });

  afterAll(async () => {
    await resetState();
    await prisma.user.deleteMany();
    await app.close();
  });

  it('POST /groups without a token → 401', async () => {
    const res = await request(server()).post('/api/groups').send({ name: 'Team' });
    expect(res.status).toBe(401);
  });

  it('POST /groups → 201 Group; creator is admin and members are populated', async () => {
    await befriend(alice, bob);
    const res = await request(server())
      .post('/api/groups')
      .set(auth(alice.accessToken))
      .send({ name: 'Team', description: 'hi', memberIds: [bob.id] });

    expect(res.status).toBe(201);
    expect(Object.keys(res.body)).toEqual(expect.arrayContaining(GROUP_KEYS));
    expect(res.body).toMatchObject({ name: 'Team', description: 'hi', role: 'admin', memberCount: 2 });
    expect(res.body.members).toHaveLength(2);
    expect(Object.keys(res.body.members[0])).toEqual(expect.arrayContaining(GROUP_MEMBER_KEYS));
    const adminMember = res.body.members.find((m: { user: { id: string } }) => m.user.id === alice.id);
    expect(adminMember.role).toBe('admin');
  });

  it('POST /groups → 422 for a non-contact member; 403 BLOCKED for a blocked member', async () => {
    const notContact = await request(server())
      .post('/api/groups')
      .set(auth(alice.accessToken))
      .send({ name: 'Team', memberIds: [bob.id] });
    expect(notContact.status).toBe(422);
    expect(notContact.body.error.code).toBe('VALIDATION_ERROR');

    await request(server())
      .post('/api/contacts/blocks')
      .set(auth(alice.accessToken))
      .send({ userId: bob.id })
      .expect(201);
    const blocked = await request(server())
      .post('/api/groups')
      .set(auth(alice.accessToken))
      .send({ name: 'Team', memberIds: [bob.id] });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('BLOCKED');
  });

  it('GET /groups/:id → 200 for a member; 404 for a non-member and unknown id', async () => {
    await befriend(alice, bob);
    const group = await createGroup(alice, [bob.id]);

    const ok = await request(server()).get(`/api/groups/${group.id}`).set(auth(bob.accessToken));
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ id: group.id, role: 'member' });

    const leak = await request(server()).get(`/api/groups/${group.id}`).set(auth(carol.accessToken));
    expect(leak.status).toBe(404);

    const unknown = await request(server()).get(`/api/groups/${NIL_UUID}`).set(auth(alice.accessToken));
    expect(unknown.status).toBe(404);
  });

  it('PATCH /groups/:id → 200 for admin; 403 for a non-admin member', async () => {
    await befriend(alice, bob);
    const group = await createGroup(alice, [bob.id]);

    const ok = await request(server())
      .patch(`/api/groups/${group.id}`)
      .set(auth(alice.accessToken))
      .send({ name: 'Renamed', description: null });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ name: 'Renamed', description: null });

    const forbidden = await request(server())
      .patch(`/api/groups/${group.id}`)
      .set(auth(bob.accessToken))
      .send({ name: 'Nope' });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
  });

  it('DELETE /groups/:id → 403 for a non-admin; 204 for admin', async () => {
    await befriend(alice, bob);
    const group = await createGroup(alice, [bob.id]);

    const forbidden = await request(server())
      .delete(`/api/groups/${group.id}`)
      .set(auth(bob.accessToken));
    expect(forbidden.status).toBe(403);

    const ok = await request(server()).delete(`/api/groups/${group.id}`).set(auth(alice.accessToken));
    expect(ok.status).toBe(204);

    const gone = await request(server()).get(`/api/groups/${group.id}`).set(auth(alice.accessToken));
    expect(gone.status).toBe(404);
  });

  it('GET /groups/:id/members → 200 Paginated for a member; 403 for a non-member', async () => {
    await befriend(alice, bob);
    const group = await createGroup(alice, [bob.id]);

    const ok = await request(server())
      .get(`/api/groups/${group.id}/members`)
      .set(auth(bob.accessToken));
    expect(ok.status).toBe(200);
    expect(ok.body).toHaveProperty('nextCursor');
    expect(ok.body.data).toHaveLength(2);
    expect(Object.keys(ok.body.data[0])).toEqual(expect.arrayContaining(GROUP_MEMBER_KEYS));

    const forbidden = await request(server())
      .get(`/api/groups/${group.id}/members`)
      .set(auth(carol.accessToken));
    expect(forbidden.status).toBe(403);
  });

  it('POST /groups/:id/members → 201 added for admin; 403 for a non-admin', async () => {
    await befriend(alice, bob);
    const group = await createGroup(alice);

    const ok = await request(server())
      .post(`/api/groups/${group.id}/members`)
      .set(auth(alice.accessToken))
      .send({ userIds: [bob.id] });
    expect(ok.status).toBe(201);
    expect(ok.body).toHaveProperty('added');
    expect(ok.body).toHaveProperty('invited');
    expect(ok.body.added).toHaveLength(1);
    expect(ok.body.added[0].user.id).toBe(bob.id);

    const forbidden = await request(server())
      .post(`/api/groups/${group.id}/members`)
      .set(auth(bob.accessToken))
      .send({ userIds: [carol.id] });
    expect(forbidden.status).toBe(403);
  });

  it('PATCH /groups/:id/members/:userId → 200 promote; 409 LAST_ADMIN demoting the only admin', async () => {
    await befriend(alice, bob);
    const group = await createGroup(alice, [bob.id]);

    const promote = await request(server())
      .patch(`/api/groups/${group.id}/members/${bob.id}`)
      .set(auth(alice.accessToken))
      .send({ role: 'admin' });
    expect(promote.status).toBe(200);
    expect(promote.body).toMatchObject({ role: 'admin', user: { id: bob.id } });

    // Promote bob first means alice is no longer the only admin — demote bob back is fine.
    const demote = await request(server())
      .patch(`/api/groups/${group.id}/members/${bob.id}`)
      .set(auth(alice.accessToken))
      .send({ role: 'member' });
    expect(demote.status).toBe(200);

    // Now alice is the only admin: demoting her must fail with 409 LAST_ADMIN.
    const last = await request(server())
      .patch(`/api/groups/${group.id}/members/${alice.id}`)
      .set(auth(alice.accessToken))
      .send({ role: 'member' });
    expect(last.status).toBe(409);
    expect(last.body.error.code).toBe('LAST_ADMIN');
  });

  it('DELETE /groups/:id/members/:userId → 403 non-admin removing other; 204 admin remove; 204 self leave', async () => {
    await befriend(alice, bob);
    await befriend(alice, carol);
    const group = await createGroup(alice, [bob.id, carol.id]);

    // bob (member) cannot remove carol.
    const forbidden = await request(server())
      .delete(`/api/groups/${group.id}/members/${carol.id}`)
      .set(auth(bob.accessToken));
    expect(forbidden.status).toBe(403);

    // admin removes carol.
    const removed = await request(server())
      .delete(`/api/groups/${group.id}/members/${carol.id}`)
      .set(auth(alice.accessToken));
    expect(removed.status).toBe(204);

    // bob leaves (self).
    const left = await request(server())
      .delete(`/api/groups/${group.id}/members/${bob.id}`)
      .set(auth(bob.accessToken));
    expect(left.status).toBe(204);

    const list = await request(server())
      .get(`/api/groups/${group.id}/members`)
      .set(auth(alice.accessToken));
    expect(list.body.data).toHaveLength(1);
  });

  it('POST /groups/:id/invite-link + POST /groups/join → 201 join, 200 idempotent, 400 invalid', async () => {
    const group = await createGroup(alice);

    const link = await request(server())
      .post(`/api/groups/${group.id}/invite-link`)
      .set(auth(alice.accessToken));
    expect(link.status).toBe(201);
    expect(Object.keys(link.body)).toEqual(expect.arrayContaining(['url', 'token', 'expiresAt']));

    const joined = await request(server())
      .post('/api/groups/join')
      .set(auth(carol.accessToken))
      .send({ inviteToken: link.body.token });
    expect(joined.status).toBe(201);
    expect(joined.body).toMatchObject({ id: group.id, role: 'member' });

    const again = await request(server())
      .post('/api/groups/join')
      .set(auth(carol.accessToken))
      .send({ inviteToken: link.body.token });
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(group.id);

    const invalid = await request(server())
      .post('/api/groups/join')
      .set(auth(carol.accessToken))
      .send({ inviteToken: 'not-a-real-token' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('INVITE_INVALID');
  });

  it('non-admin invite-link creation → 403', async () => {
    await befriend(alice, bob);
    const group = await createGroup(alice, [bob.id]);
    const res = await request(server())
      .post(`/api/groups/${group.id}/invite-link`)
      .set(auth(bob.accessToken));
    expect(res.status).toBe(403);
  });
});
