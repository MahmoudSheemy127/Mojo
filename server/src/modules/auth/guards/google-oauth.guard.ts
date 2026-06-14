// src/modules/auth/guards/google-oauth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard for the Google OAuth start + callback routes. Unlike the default
 * `AuthGuard`, it never throws on a failed/denied handshake — it returns `null`
 * so the controller can honor the contract by redirecting the browser back to
 * the frontend (`/login?error=oauth_failed`) instead of emitting a 401.
 */
@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  handleRequest<TUser = unknown>(_err: unknown, user: TUser): TUser {
    return (user || null) as TUser;
  }
}
