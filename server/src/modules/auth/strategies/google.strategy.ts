// src/modules/auth/strategies/google.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile, type VerifyCallback } from 'passport-google-oauth20';

/**
 * Normalized Google profile attached to `request.user` after the consent
 * callback. The strategy stays thin — find-or-create lives in AuthService.
 */
export interface GoogleProfile {
  providerUserId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    // Fall back to placeholders so the app still boots when Google is not
    // configured (passport-google-oauth20 throws on an empty clientID). The
    // OAuth flow only works once real credentials are set in the environment.
    super({
      clientID: config.get<string>('google.clientId') || 'google-oauth-not-configured',
      clientSecret: config.get<string>('google.clientSecret') || 'google-oauth-not-configured',
      callbackURL:
        config.get<string>('google.callbackUrl') ||
        'http://localhost:4000/api/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(
        new UnauthorizedException({ code: 'OAUTH_FAILED', message: 'Google account has no email' }),
        undefined,
      );
      return;
    }

    const user: GoogleProfile = {
      providerUserId: profile.id,
      email: email.toLowerCase(),
      displayName: profile.displayName || email.split('@')[0],
      avatarUrl: profile.photos?.[0]?.value ?? null,
    };
    done(null, user);
  }
}
