// src/modules/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';

export interface AccessTokenPayload {
  sub: string; // userId
}

/**
 * Validates the access JWT from `Authorization: Bearer`, loads the account, and
 * returns the request principal attached to `request.user`.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret') as string,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthUser> {
    const account = await this.prisma.account.findUnique({
      where: { userId: payload.sub },
    });
    if (!account) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'User no longer exists',
      });
    }
    return { id: payload.sub, username: account.username, email: account.email };
  }
}
