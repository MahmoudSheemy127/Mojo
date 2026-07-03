// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';
import type {
  PublicUser,
  SelfUser,
  ContactRequest,
  DmConversation,
  GroupConversation,
  ApiMessage,
  Group,
  ApiGroupMember,
  ApiNotification,
} from '@/types/api';

const API = 'http://localhost:4000/api';

export const mockUser: SelfUser = {
  id: '11111111-1111-1111-1111-111111111111',
  username: 'alice',
  displayName: 'Alice',
  avatarUrl: null,
  bio: null,
  presence: 'online',
  email: 'alice@example.com',
  createdAt: '2026-01-01T00:00:00.000Z',
};

export const mockFriends: PublicUser[] = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    username: 'aria',
    displayName: 'Aria Chen',
    avatarUrl: null,
    bio: null,
    presence: 'online',
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    username: 'ben',
    displayName: 'Ben Okafor',
    avatarUrl: null,
    bio: null,
    presence: 'away',
  },
];

/** A user not yet connected — appears in search with relationship 'none'. */
export const mockSearchStranger: PublicUser = {
  id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  username: 'charlie',
  displayName: 'Charlie Doe',
  avatarUrl: null,
  bio: null,
  presence: 'online',
};

export const mockBlockedUsers: PublicUser[] = [
  {
    id: '22222222-2222-2222-2222-222222222222',
    username: 'mallory',
    displayName: 'Mallory',
    avatarUrl: null,
    bio: null,
    presence: 'offline',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    username: 'trent',
    displayName: 'Trent',
    avatarUrl: null,
    bio: null,
    presence: 'offline',
  },
];

export const mockContactRequest: ContactRequest = {
  id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  from: mockUser,
  to: {
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    username: 'charlie',
    displayName: 'Charlie',
    avatarUrl: null,
    bio: null,
    presence: 'offline',
  },
  createdAt: '2026-06-01T00:00:00.000Z',
};

export const mockDmConversation: DmConversation = {
  id: 'conv-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  type: 'dm',
  otherUser: {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    username: 'aria',
    displayName: 'Aria Chen',
    avatarUrl: null,
    bio: null,
    presence: 'online',
  },
  lastMessage: {
    id: 'msg-1111-1111-1111-111111111111',
    conversationId: 'conv-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    sequence: 1,
    senderId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    content: 'Hey there!',
    attachments: [],
    status: 'read',
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    deletedAt: null,
  },
  lastActivityAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  unreadCount: 2,
};

export const GROUP_ID = 'group-1111-1111-1111-111111111111';

export const mockGroup: Group = {
  id: GROUP_ID,
  name: 'Design Guild',
  description: 'Where the design magic happens.',
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  memberCount: 2,
  role: 'admin',
};

export const mockGroupMembers: ApiGroupMember[] = [
  {
    user: {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      username: 'aria',
      displayName: 'Aria Chen',
      avatarUrl: null,
      bio: null,
      presence: 'online',
    },
    role: 'admin',
    joinedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    user: {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      username: 'ben',
      displayName: 'Ben Okafor',
      avatarUrl: null,
      bio: null,
      presence: 'away',
    },
    role: 'member',
    joinedAt: '2026-01-02T00:00:00.000Z',
  },
];

export const mockGroupConversation: GroupConversation = {
  id: 'conv-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  type: 'group',
  name: 'Design Guild',
  avatarUrl: null,
  memberCount: 5,
  role: 'member',
  lastMessage: null,
  lastActivityAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  unreadCount: 0,
};

export const mockNotifications: ApiNotification[] = [
  {
    id: 'notif-1111-1111-1111-111111111111',
    type: 'friend_request',
    actor: mockFriends[0]!,
    read: false,
    createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    payload: { requestId: 'req-1111-1111-1111-111111111111' },
  },
  {
    id: 'notif-2222-2222-2222-222222222222',
    type: 'group_invite',
    actor: mockFriends[1]!,
    read: false,
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    payload: {
      inviteId: 'inv-2222-2222-2222-222222222222',
      groupId: 'group-2222-2222-2222-222222222222',
    },
  },
  {
    id: 'notif-3333-3333-3333-333333333333',
    type: 'mention',
    actor: mockFriends[0]!,
    read: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    payload: {
      text: 'Aria Chen mentioned you',
      conversationId: 'conv-3333-3333-3333-333333333333',
      messageId: 'msg-3333-3333-3333-333333333333',
    },
  },
];

const apiError = (code: string, message: string) => ({ error: { code, message } });

export const handlers = [
  // ── Login ─────────────────────────────────────────────────────
  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { identifier: string; password: string };
    if (body.identifier === 'ratelimited') {
      return HttpResponse.json(apiError('RATE_LIMITED', 'Too many requests'), {
        status: 429,
      });
    }
    if (body.password !== 'correct-horse') {
      return HttpResponse.json(
        apiError('INVALID_CREDENTIALS', 'Invalid credentials'),
        { status: 401 },
      );
    }
    return HttpResponse.json({ user: mockUser, accessToken: 'access-token-123' });
  }),

  // ── Signup ────────────────────────────────────────────────────
  http.post(`${API}/auth/signup`, async ({ request }) => {
    const body = (await request.json()) as { username: string };
    if (body.username === 'taken') {
      return HttpResponse.json(apiError('USERNAME_TAKEN', 'Username taken'), {
        status: 409,
      });
    }
    return HttpResponse.json(
      { user: mockUser, accessToken: 'access-token-123' },
      { status: 201 },
    );
  }),

  // ── Refresh (used by the axios interceptor) ───────────────────
  http.post(`${API}/auth/refresh`, () =>
    HttpResponse.json({ accessToken: 'refreshed-token-456' }),
  ),

  // ── Logout ────────────────────────────────────────────────────
  http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })),

  // ── Password reset request ────────────────────────────────────
  http.post(`${API}/auth/password-reset/request`, () =>
    HttpResponse.json({ message: 'If that email exists, a link was sent.' }, {
      status: 202,
    }),
  ),

  // ── Users: profile ────────────────────────────────────────────
  http.get(`${API}/users/me`, () => HttpResponse.json(mockUser)),

  http.patch(`${API}/users/me`, async ({ request }) => {
    const body = (await request.json()) as {
      displayName?: string;
      bio?: string | null;
    };
    return HttpResponse.json({ ...mockUser, ...body });
  }),

  // ── Users: avatar ─────────────────────────────────────────────
  http.put(`${API}/users/me/avatar`, () =>
    HttpResponse.json({ avatarUrl: 'https://cdn.example.com/avatar.png' }),
  ),
  http.delete(`${API}/users/me/avatar`, () => new HttpResponse(null, { status: 204 })),

  // ── Users: presence ───────────────────────────────────────────
  http.patch(`${API}/users/me/presence`, async ({ request }) => {
    const body = (await request.json()) as { status: string };
    return HttpResponse.json({ presence: body.status });
  }),

  // ── Users: search ─────────────────────────────────────────────
  http.get(`${API}/users/search`, ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') ?? '';
    const friendIds = new Set(mockFriends.map((u) => u.id));
    const allUsers = [...mockFriends, mockSearchStranger];
    const results = allUsers
      .filter(
        (u) =>
          u.username.toLowerCase().includes(q.toLowerCase()) ||
          u.displayName.toLowerCase().includes(q.toLowerCase()),
      )
      .map((u) => ({
        user: u,
        relationship: friendIds.has(u.id)
          ? ('friends' as const)
          : ('none' as const),
      }));
    return HttpResponse.json({ data: results, nextCursor: null });
  }),

  // ── Contacts: friends ─────────────────────────────────────────
  http.get(`${API}/contacts`, () =>
    HttpResponse.json({ data: mockFriends, nextCursor: null }),
  ),

  // ── Contacts: requests ────────────────────────────────────────
  http.get(`${API}/contacts/requests`, () =>
    HttpResponse.json({ incoming: [], outgoing: [mockContactRequest] }),
  ),

  http.post(`${API}/contacts/requests`, () =>
    HttpResponse.json(mockContactRequest, { status: 201 }),
  ),

  http.post(`${API}/contacts/requests/:requestId/accept`, () =>
    HttpResponse.json({ friend: mockFriends[0] }),
  ),

  http.post(`${API}/contacts/requests/:requestId/decline`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // ── Contacts: remove ──────────────────────────────────────────
  http.delete(`${API}/contacts/:userId`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // ── Contacts: blocks ──────────────────────────────────────────
  http.post(`${API}/contacts/blocks`, async ({ request }) => {
    const body = (await request.json()) as { userId: string };
    const blocked = mockFriends.find((u) => u.id === body.userId) ?? mockFriends[0]!;
    return HttpResponse.json({ blockedUser: blocked }, { status: 201 });
  }),

  // ── Contacts: blocked users (used by Settings) ────────────────
  http.get(`${API}/contacts/blocked`, () =>
    HttpResponse.json({ data: mockBlockedUsers, nextCursor: null }),
  ),
  http.delete(`${API}/contacts/blocks/:userId`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // ── Conversations ─────────────────────────────────────────────
  http.get(`${API}/conversations`, () =>
    HttpResponse.json({
      data: [mockDmConversation, mockGroupConversation],
      nextCursor: null,
    }),
  ),

  http.post(`${API}/conversations/dm`, async ({ request }) => {
    const body = (await request.json()) as { userId: string };
    return HttpResponse.json(
      { ...mockDmConversation, id: `dm-${body.userId}` },
      { status: 200 },
    );
  }),

  http.get(`${API}/conversations/:conversationId`, ({ params }) =>
    HttpResponse.json({
      ...mockDmConversation,
      id: params['conversationId'] as string,
    }),
  ),

  http.post(`${API}/conversations/:conversationId/read`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // ── Messages ──────────────────────────────────────────────────────
  http.get(`${API}/conversations/:conversationId/messages`, ({ params }) => {
    const conversationId = params['conversationId'] as string;
    const msgs: ApiMessage[] = [
      {
        id: 'msg-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        conversationId,
        sequence: 1,
        senderId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        content: 'Hey there!',
        attachments: [],
        status: 'read',
        createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        deletedAt: null,
      },
      {
        id: 'msg-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        conversationId,
        sequence: 2,
        senderId: '11111111-1111-1111-1111-111111111111',
        content: 'Hello! How are you?',
        attachments: [],
        status: 'delivered',
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        deletedAt: null,
      },
    ];
    return HttpResponse.json({ data: msgs, nextCursor: null });
  }),

  http.post(`${API}/conversations/:conversationId/messages`, async ({ request, params }) => {
    const body = (await request.json()) as {
      content: string | null;
      clientNonce?: string;
    };
    const conversationId = params['conversationId'] as string;
    const msg: ApiMessage = {
      id: crypto.randomUUID(),
      conversationId,
      sequence: 100,
      senderId: '11111111-1111-1111-1111-111111111111',
      content: body.content,
      attachments: [],
      status: 'sent',
      createdAt: new Date().toISOString(),
      deletedAt: null,
      ...(body.clientNonce ? { clientNonce: body.clientNonce } : {}),
    };
    return HttpResponse.json(msg, { status: 201 });
  }),

  http.delete(`${API}/messages/:messageId`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // ── Groups ────────────────────────────────────────────────────────
  http.post(`${API}/groups`, async ({ request }) => {
    const body = (await request.json()) as {
      name: string;
      description?: string;
      memberIds?: string[];
    };
    const group: Group = {
      id: 'group-1111-1111-1111-111111111111',
      name: body.name,
      description: body.description ?? null,
      avatarUrl: null,
      createdAt: new Date().toISOString(),
      memberCount: (body.memberIds?.length ?? 0) + 1,
      role: 'admin',
    };
    return HttpResponse.json(group, { status: 201 });
  }),

  http.get(`${API}/groups/:groupId`, ({ params }) => {
    const group: Group = {
      id: params['groupId'] as string,
      name: 'Design Guild',
      description: 'Where the design magic happens.',
      avatarUrl: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      memberCount: 3,
      role: 'admin',
      members: [
        {
          user: mockFriends[0]!,
          role: 'admin',
          joinedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          user: mockFriends[1]!,
          role: 'member',
          joinedAt: '2026-01-02T00:00:00.000Z',
        },
      ],
    };
    return HttpResponse.json(group);
  }),

  http.patch(`${API}/groups/:groupId`, async ({ params, request }) => {
    const body = (await request.json()) as {
      name?: string;
      description?: string | null;
    };
    const group: Group = {
      id: params['groupId'] as string,
      name: body.name ?? 'Design Guild',
      description: body.description !== undefined ? body.description : 'Updated.',
      avatarUrl: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      memberCount: 3,
      role: 'admin',
    };
    return HttpResponse.json(group);
  }),

  http.delete(`${API}/groups/:groupId`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  http.get(`${API}/groups/:groupId/members`, ({ params }) => {
    const members: ApiGroupMember[] = [
      {
        user: { ...mockFriends[0]!, id: params['groupId'] === 'err' ? 'x' : mockFriends[0]!.id },
        role: 'admin',
        joinedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        user: mockFriends[1]!,
        role: 'member',
        joinedAt: '2026-01-02T00:00:00.000Z',
      },
    ];
    return HttpResponse.json({ data: members, nextCursor: null });
  }),

  http.post(`${API}/groups/:groupId/members`, async ({ request }) => {
    const body = (await request.json()) as { userIds: string[] };
    const added: ApiGroupMember[] = body.userIds.map((uid) => ({
      user: mockFriends.find((f) => f.id === uid) ?? {
        id: uid,
        username: 'user',
        displayName: 'User',
        avatarUrl: null,
        bio: null,
        presence: 'offline' as const,
      },
      role: 'member' as const,
      joinedAt: new Date().toISOString(),
    }));
    return HttpResponse.json({ added, invited: [] }, { status: 201 });
  }),

  http.patch(`${API}/groups/:groupId/members/:userId`, async ({ params, request }) => {
    const body = (await request.json()) as { role: 'admin' | 'member' };
    const member: ApiGroupMember = {
      user: mockFriends.find((f) => f.id === params['userId']) ?? mockFriends[0]!,
      role: body.role,
      joinedAt: '2026-01-01T00:00:00.000Z',
    };
    return HttpResponse.json(member);
  }),

  http.delete(`${API}/groups/:groupId/members/:userId`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  http.put(`${API}/groups/:groupId/avatar`, ({ params }) =>
    HttpResponse.json({
      avatarId: `avatar-id-${params['groupId']}`,
      avatarUrl: `https://cdn.mojo.app/groups/${params['groupId']}/avatar.png`,
    }),
  ),

  http.delete(`${API}/groups/:groupId/avatar`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  http.post(`${API}/groups/:groupId/invite-link`, ({ params }) =>
    HttpResponse.json(
      {
        url: `https://mojo.app/join/test-token-${params['groupId']}`,
        token: `test-token-${params['groupId']}`,
        expiresAt: null,
      },
      { status: 201 },
    ),
  ),

  http.post(`${API}/groups/join`, () =>
    HttpResponse.json(
      {
        id: 'group-joined-1111',
        name: 'Joined Group',
        description: null,
        avatarUrl: null,
        createdAt: new Date().toISOString(),
        memberCount: 5,
        role: 'member',
      },
      { status: 201 },
    ),
  ),

  // ── Groups: invite accept / decline (FR-19) ───────────────────
  http.post(`${API}/groups/:groupId/invites/:inviteId/accept`, ({ params }) =>
    HttpResponse.json({
      group: {
        id: params['groupId'] as string,
        name: 'Design Guild',
        description: null,
        avatarUrl: null,
        createdAt: new Date().toISOString(),
        memberCount: 4,
        role: 'member',
      },
    }),
  ),
  http.post(`${API}/groups/:groupId/invites/:inviteId/decline`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // ── Groups: join-request accept / decline (FR-19, admin) ──────
  http.post(
    `${API}/groups/:groupId/join-requests/:requestId/accept`,
    () =>
      HttpResponse.json({
        member: {
          user: mockFriends[1]!,
          role: 'member' as const,
          joinedAt: new Date().toISOString(),
        },
      }),
  ),
  http.post(`${API}/groups/:groupId/join-requests/:requestId/decline`, () =>
    new HttpResponse(null, { status: 204 }),
  ),

  // ── Notifications (FR-30) ─────────────────────────────────────
  http.get(`${API}/notifications`, () =>
    HttpResponse.json({ data: mockNotifications, nextCursor: null }),
  ),
  http.get(`${API}/notifications/count`, () =>
    HttpResponse.json({ count: 2 }),
  ),
  http.post(`${API}/notifications/seen`, () =>
    new HttpResponse(null, { status: 204 }),
  ),
];
