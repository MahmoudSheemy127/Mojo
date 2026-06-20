// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';
import type { SelfUser } from '@/types/api';

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
];
