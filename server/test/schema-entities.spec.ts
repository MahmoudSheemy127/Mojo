// test/schema-entities.spec.ts
// Gate G1 — schema conformance for the entities backing the **users** feature
// (docs/qa/qa.md §G1, docs/ERD/prisma-schema-design.md). Boots a real Prisma client
// against the database in DATABASE_URL and asserts both the CRUD round-trip and the
// constraints that carry business meaning: a violating write MUST fail.
//   - Account.username unique  (login identifier + user search)
//   - Account.email unique
//   - Relation @@unique([ownerId, relatedId, type])  (one edge per kind per pair)
import 'dotenv/config';
import { Prisma, RelationType } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';

// Namespace this run's rows so we never collide with or delete other data.
const TAG = `g1_${Date.now()}_`;

/** Assert that `op` rejects with a Prisma unique-constraint violation (P2002). */
async function expectUniqueViolation(op: Promise<unknown>): Promise<void> {
  try {
    await op;
    throw new Error('expected a unique-constraint violation, but the write succeeded');
  } catch (e) {
    expect(e).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((e as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
  }
}

describe('Schema G1 — users-feature entities', () => {
  const prisma = new PrismaService();
  const createdUserIds: string[] = [];

  const newUser = async (key: string) => {
    const user = await prisma.user.create({
      data: {
        displayName: `${TAG}${key}`,
        account: {
          create: { username: `${TAG}${key}`, email: `${TAG}${key}@example.com` },
        },
      },
      include: { account: true },
    });
    createdUserIds.push(user.id);
    return user;
  };

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    // Cascades remove the account + any relations referencing these users.
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  it('User + Account round-trips and presence defaults to OFFLINE', async () => {
    const user = await newUser('alice');

    const loaded = await prisma.user.findUnique({
      where: { id: user.id },
      include: { account: true },
    });

    expect(loaded).not.toBeNull();
    expect(loaded!.presence).toBe('OFFLINE'); // schema @default(OFFLINE)
    expect(loaded!.account!.username).toBe(`${TAG}alice`);
    expect(loaded!.account!.email).toBe(`${TAG}alice@example.com`);
  });

  it('rejects a duplicate Account.username (unique)', async () => {
    await newUser('dupname');
    await expectUniqueViolation(
      prisma.user.create({
        data: {
          displayName: `${TAG}dupname2`,
          account: {
            create: { username: `${TAG}dupname`, email: `${TAG}dupname2@example.com` },
          },
        },
      }),
    );
  });

  it('rejects a duplicate Account.email (unique)', async () => {
    await newUser('dupmail');
    await expectUniqueViolation(
      prisma.user.create({
        data: {
          displayName: `${TAG}dupmail2`,
          account: {
            create: { username: `${TAG}dupmail2`, email: `${TAG}dupmail@example.com` },
          },
        },
      }),
    );
  });

  it('rejects a duplicate Relation for the same (owner, related, type)', async () => {
    const a = await newUser('rel_a');
    const b = await newUser('rel_b');

    await prisma.relation.create({
      data: { ownerId: a.id, relatedId: b.id, type: RelationType.FRIEND },
    });

    await expectUniqueViolation(
      prisma.relation.create({
        data: { ownerId: a.id, relatedId: b.id, type: RelationType.FRIEND },
      }),
    );
  });
});
