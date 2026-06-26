// test/schema-groups.spec.ts
// Gate G1 — schema conformance for the entities backing the **groups** feature
// (docs/qa/qa.md §G1, docs/ERD/prisma-schema-design.md). Boots a real Prisma client and
// asserts both the CRUD round-trip and the constraints that carry business meaning — a
// violating write MUST fail:
//   - Group.conversationId unique  (a group IS a conversation, 1:1)
//   - Member @@unique([userId, groupId])  (one membership per user per group)
//   - GroupInviteLink.token unique  (a token resolves to exactly one link)
import 'dotenv/config';
import { Prisma, GroupRole } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';

const TAG = `g1grp_${Date.now()}_`;

async function expectUniqueViolation(op: Promise<unknown>): Promise<void> {
  try {
    await op;
    throw new Error('expected a unique-constraint violation, but the write succeeded');
  } catch (e) {
    expect(e).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((e as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
  }
}

describe('Schema G1 — groups-feature entities', () => {
  const prisma = new PrismaService();
  const createdUserIds: string[] = [];
  const createdConversationIds: string[] = [];

  const newUser = async (key: string) => {
    const user = await prisma.user.create({
      data: {
        displayName: `${TAG}${key}`,
        account: { create: { username: `${TAG}${key}`, email: `${TAG}${key}@example.com` } },
      },
    });
    createdUserIds.push(user.id);
    return user;
  };

  /** Create a Conversation + Group (group id reuses the conversation id) and return both. */
  const newGroup = async (name: string) => {
    const conversation = await prisma.conversation.create({ data: { type: 'GROUP' } });
    createdConversationIds.push(conversation.id);
    const group = await prisma.group.create({
      data: { id: conversation.id, conversationId: conversation.id, name: `${TAG}${name}` },
    });
    return { conversation, group };
  };

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    // Deleting conversations cascades groups, members, and invite links.
    await prisma.conversation.deleteMany({ where: { id: { in: createdConversationIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  it('Group + Member round-trip; role defaults to MEMBER', async () => {
    const admin = await newUser('admin');
    const { group } = await newGroup('team');

    await prisma.member.create({
      data: { userId: admin.id, groupId: group.id, role: GroupRole.ADMIN },
    });
    const member = await prisma.member.create({
      data: { userId: (await newUser('member')).id, groupId: group.id },
    });

    expect(member.role).toBe('MEMBER'); // schema @default(MEMBER)

    const loaded = await prisma.group.findUnique({
      where: { id: group.id },
      include: { members: true },
    });
    expect(loaded!.conversationId).toBe(group.id);
    expect(loaded!.members).toHaveLength(2);
  });

  it('rejects a second Group for the same conversation (Group.conversationId unique)', async () => {
    const { conversation } = await newGroup('one-per-conversation');
    await expectUniqueViolation(
      prisma.group.create({
        data: { conversationId: conversation.id, name: `${TAG}dup` },
      }),
    );
  });

  it('rejects a duplicate Member for the same (userId, groupId)', async () => {
    const user = await newUser('dupmember');
    const { group } = await newGroup('dupmember-grp');

    await prisma.member.create({ data: { userId: user.id, groupId: group.id } });
    await expectUniqueViolation(
      prisma.member.create({ data: { userId: user.id, groupId: group.id } }),
    );
  });

  it('rejects a duplicate GroupInviteLink.token (unique)', async () => {
    const creator = await newUser('linker');
    const { group } = await newGroup('link-grp');
    const token = `${TAG}token`;

    await prisma.groupInviteLink.create({
      data: { groupId: group.id, token, createdById: creator.id },
    });
    await expectUniqueViolation(
      prisma.groupInviteLink.create({
        data: { groupId: group.id, token, createdById: creator.id },
      }),
    );
  });
});
