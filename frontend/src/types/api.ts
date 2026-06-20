// src/types/api.ts
// Clean, hand-friendly aliases derived from the generated contract client.
// Do NOT hand-write request/response shapes here — always source them from
// `api.generated.ts` (regenerated from docs/contract/*.openapi.yaml).
import type { components, operations } from './api.generated';

// ── Shared entities ─────────────────────────────────────────────
export type SelfUser = components['schemas']['SelfUser'];
export type PublicUser = components['schemas']['PublicUser'];
export type Presence = components['schemas']['Presence'];

// ── Error envelope ──────────────────────────────────────────────
export type ApiError = components['schemas']['ApiError'];

// ── Auth: login ─────────────────────────────────────────────────
export type LoginRequest =
  operations['login']['requestBody']['content']['application/json'];
export type LoginResponse =
  operations['login']['responses']['200']['content']['application/json'];

// ── Auth: signup ────────────────────────────────────────────────
export type SignupRequest =
  operations['signup']['requestBody']['content']['application/json'];
export type SignupResponse =
  operations['signup']['responses']['201']['content']['application/json'];

// ── Auth: refresh ───────────────────────────────────────────────
export type RefreshResponse =
  operations['refresh']['responses']['200']['content']['application/json'];
