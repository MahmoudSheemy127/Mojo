# Auth — API Contract

Covers signup, login, logout, token refresh, Google OAuth, and password reset.
Token model and error envelope are defined in `README.md`.

> Token model recap: short-lived access JWT in `Authorization: Bearer …`; rotating
> refresh token in an `httpOnly` cookie consumed only by `POST /auth/refresh`.

All auth endpoints are rate limited (NF-11): ≤ 10 requests / minute / IP. Exceeding →
`429 RATE_LIMITED`.

---

## Sign up

Flow: `[FE] —(username, email, password)→ [BE] —(validate, hash pw, persist, issue tokens)→ (SelfUser + accessToken, set refresh cookie)→ [FE]`

`POST /auth/signup` · **Public** · FR-01

Request body:
```typescript
{
  username: string;   // 3–32 chars, [a-zA-Z0-9_], unique (case-insensitive)
  email: string;      // valid email, unique
  password: string;   // ≥ 8 chars
  acceptedTerms: true; // must be true (compliance NFR)
}
```

Response `201`:
```typescript
{
  user: SelfUser;
  accessToken: string;   // JWT, ~15 min expiry
}
// + Set-Cookie: refreshToken=…; HttpOnly; Secure; SameSite=Strict
```

Errors: `409 CONFLICT` (`USERNAME_TAKEN` | `EMAIL_TAKEN` via `error.code`),
`422 VALIDATION_ERROR`, `429 RATE_LIMITED`.

Realtime: none.

---

## Log in

Flow: `[FE] —(identifier, password)→ [BE] —(verify hash, issue tokens)→ (SelfUser + accessToken, set refresh cookie)→ [FE]`

`POST /auth/login` · **Public** · FR-01

Request body:
```typescript
{
  identifier: string;  // username OR email
  password: string;
}
```

Response `200`:
```typescript
{
  user: SelfUser;
  accessToken: string;
}
// + Set-Cookie: refreshToken=…
```

Errors: `401 UNAUTHENTICATED` (code `INVALID_CREDENTIALS` — do **not** reveal whether
the identifier exists), `429 RATE_LIMITED`, `422 VALIDATION_ERROR`.

Realtime: on success the FE opens the socket connection (see `realtime.md`).

---

## Refresh access token

Flow: `[FE] —(refresh cookie, automatic)→ [BE] —(verify + rotate refresh, issue new access)→ (accessToken, set new refresh cookie)→ [FE]`

`POST /auth/refresh` · **Public** (authenticated via cookie, not bearer)

Request: no body. The browser sends the `refreshToken` cookie automatically
(`withCredentials: true`).

Response `200`:
```typescript
{ accessToken: string; }
// + Set-Cookie: refreshToken=…   (rotated — old one is invalidated)
```

Errors: `401 UNAUTHENTICATED` (code `REFRESH_INVALID` — cookie missing, expired, or
already used/rotated). On this error the FE clears auth state and routes to `/login`.

> FE note: called by the Axios response interceptor on a `401 TOKEN_EXPIRED` from any
> authenticated request, then the original request is retried once.

---

## Log out

Flow: `[FE] —(access token)→ [BE] —(invalidate refresh token, clear cookie)→ (204)→ [FE]`

`POST /auth/logout` · **Authenticated** · FR-03

Request: no body.

Response `204`. Clears the refresh cookie and revokes the current refresh token
server-side (token invalidation per FR-03).

Realtime: BE disconnects the user's socket(s); presence transitions to `offline`
and a `presence:changed` event is emitted to their contacts.

> Optional: `POST /auth/logout?all=true` revokes **all** refresh tokens for the user
> (log out everywhere). Nice-to-have.

---

## Google OAuth

Flow: `[FE] —(redirect)→ [BE /auth/google] —(redirect)→ [Google] —(callback w/ code)→ [BE /auth/google/callback] —(exchange code, find/create user, issue tokens)→ (redirect to FE)→ [FE]`

### Start
`GET /auth/google` · **Public** · FR-02
Redirects (302) the browser to Google's consent screen.

### Callback
`GET /auth/google/callback?code=…&state=…` · **Public** · FR-02

BE exchanges the code, finds or creates the user, issues tokens, sets the refresh
cookie, and redirects the browser back to the frontend (e.g.
`{FE_URL}/auth/callback#accessToken=…` or sets a short-lived handoff). The FE callback
route stores the access token and routes to `/c`.

Errors: redirect to `{FE_URL}/login?error=oauth_failed` on failure.

> Decide the access-token handoff mechanism (URL fragment vs a follow-up
> `POST /auth/refresh` using the freshly-set cookie). The refresh-cookie + immediate
> `/auth/refresh` approach keeps the access token out of the URL — recommended.

---

## Password reset — request link

Flow: `[FE] —(email)→ [BE] —(if account exists, email a time-limited token link)→ (202, no enumeration)→ [FE]`

`POST /auth/password-reset/request` · **Public** · FR-04

Request body:
```typescript
{ email: string; }
```

Response `202` (always, whether or not the email exists — prevents account
enumeration). Body:
```typescript
{ message: "If that email is registered, a reset link has been sent." }
```

Errors: `429 RATE_LIMITED`.

---

## Password reset — confirm

Flow: `[FE /reset-password?token=…] —(token, newPassword)→ [BE] —(verify token, set new hash, invalidate token + sessions)→ (204)→ [FE → /login]`

`POST /auth/password-reset/confirm` · **Public** · FR-04

Request body:
```typescript
{
  token: string;       // from the emailed link, time-limited
  newPassword: string; // ≥ 8 chars
}
```

Response `204`. BE invalidates the reset token (single use) and revokes existing
refresh tokens (force re-login).

Errors: `422 VALIDATION_ERROR` (weak password), `400`/`410` with code
`RESET_TOKEN_INVALID` (expired or already used), `429 RATE_LIMITED`.

---

## Implementation notes

- **BE controllers**: `auth.controller.ts` with one handler per endpoint; validation
  via Zod schemas mirroring the request bodies above. Password hashing with
  bcrypt(cost ≥ 12) or Argon2id (NF-09). Never log plaintext passwords (NF-15).
- **FE api**: `features/auth/api.ts` → `signup`, `login`, `logout`, `refresh`,
  `requestPasswordReset`, `confirmPasswordReset`. The Google flow is a full-page
  redirect, not an XHR.
- **FE state**: on signup/login success, write `SelfUser` + `accessToken` into
  `authStore`, then connect the socket.
