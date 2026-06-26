// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';
import type {
  PublicUser,
  SelfUser,
  ContactRequest,
  DmConversation,
  GroupConversation,
  ApiMessage,
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
];
