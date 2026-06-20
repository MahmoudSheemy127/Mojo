// src/modules/auth/token.service.ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { hashToken } from '../../common/utils/hash';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Owns the token lifecycle. Access tokens are stateless JWTs; refresh tokens are
 * JWTs whose deterministic hash is persisted in `Token (type=REFRESH)` so they
 * can be rotated and revoked. Raw tokens are never stored — only their hash.
 */
@Injectable()
export class TokenService {
  
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async issuePair(userId: string): Promise<TokenPair> {
    return (await this.signAndStore(userId)).pair;
  }

  /** Mint a fresh pair, then revoke the old refresh token and chain it forward. */
  async rotateRefresh(userId: string, oldTokenId: string): Promise<TokenPair> {
    const { pair, tokenId } = await this.signAndStore(userId);
    await this.prisma.token.update({
      where: { id: oldTokenId },
      data: { revokedAt: new Date(), replacedById: tokenId },
    });
    return pair;
  }

  /** Revoke a single refresh token (logout). No-op if already revoked. */
  async revoke(tokenId: string): Promise<void> {
    await this.prisma.token.updateMany({
      where: { id: tokenId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Revoke every live refresh token for a user (logout-everywhere). */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.token.updateMany({
      where: { userId, type: 'REFRESH', revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async signAndStore(userId: string): Promise<{ pair: TokenPair; tokenId: string }> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId },
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: this.config.get<number>('jwt.accessTtl'),
      },
    );

    const jti = randomUUID();
    const refreshTtl = this.config.get<number>('jwt.refreshTtl') as number;
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, jti },
      { secret: this.config.get<string>('jwt.refreshSecret'), expiresIn: refreshTtl },
    );

    await this.prisma.token.create({
      data: {
        id: jti,
        userId,
        type: 'REFRESH',
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
      },
    });

    return { pair: { accessToken, refreshToken }, tokenId: jti };
  }
}
