// src/modules/auth/strategies/jwt-refresh.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { hashToken } from '../../../common/utils/hash';

export interface RefreshPrincipal {
  userId: string;
  tokenId: string;
  rawToken: string;
}

interface RefreshTokenPayload {
  sub: string; // userId
  jti: string; // token id
}

/** Pull the rotating refresh token from the httpOnly cookie. */
function cookieExtractor(req: Request): string | null {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.refreshToken ?? null;
}

/**
 * Used only by POST /auth/refresh. Verifies the refresh JWT signature from the
 * cookie, then confirms the matching `Token` row is still live (not revoked,
 * not expired) by its deterministic hash.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.refreshSecret') as string,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: RefreshTokenPayload): Promise<RefreshPrincipal> {
    const raw = cookieExtractor(req);
    if (!raw) {
      throw new UnauthorizedException({ code: 'REFRESH_INVALID', message: 'Missing refresh token' });
    }

    const token = await this.prisma.token.findUnique({ where: { tokenHash: hashToken(raw) } });
    const invalid =
      !token ||
      token.type !== 'REFRESH' ||
      token.revokedAt !== null ||
      token.expiresAt.getTime() < Date.now() ||
      token.userId !== payload.sub;

    if (invalid) {
      throw new UnauthorizedException({
        code: 'REFRESH_INVALID',
        message: 'Refresh token invalid or expired',
      });
    }

    return { userId: token!.userId, tokenId: token!.id, rawToken: raw };
  }
}
