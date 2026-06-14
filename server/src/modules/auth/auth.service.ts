// src/modules/auth/auth.service.ts
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { hashPassword, verifyPassword, hashToken } from '../../common/utils/hash';
import { uniqueConflictFields } from '../../common/utils/prisma-errors';
import { TokenService, TokenPair } from './token.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import type { GoogleProfile } from './strategies/google.strategy';

/** The contract's SelfUser shape (docs/api/README.md §Shared entity types). */
export interface SelfUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  presence: 'online' | 'away' | 'dnd' | 'offline';
  email: string;
  createdAt: string;
}

export interface AuthResult extends TokenPair {
  user: SelfUser;
}

type UserProfile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  presence: string;
  createdAt: Date;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async signup(dto: SignupDto): Promise<AuthResult> {
    const passwordHash = await hashPassword(dto.password);

    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          displayName: dto.username,
          account: {
            create: {
              username: dto.username,
              email: dto.email.toLowerCase(),
              passwordHash,
            },
          },
        },
        include: { account: true },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        if (uniqueConflictFields(e).some((f) => f.includes('email'))) {
          throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'Email already in use' });
        }
        throw new ConflictException({ code: 'USERNAME_TAKEN', message: 'Username already taken' });
      }
      throw e;
    }

    const pair = await this.tokens.issuePair(user.id);
    return { user: this.toSelfUser(user, user.account!), ...pair };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const account = await this.prisma.account.findFirst({
      where: { OR: [{ username: dto.identifier }, { email: dto.identifier.toLowerCase() }] },
      include: { user: true },
    });

    // Uniform failure — never reveal whether the identifier exists (auth.md).
    const ok = account?.passwordHash
      ? await verifyPassword(account.passwordHash, dto.password)
      : false;
    if (!account || !ok) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      });
    }

    const pair = await this.tokens.issuePair(account.userId);
    return { user: this.toSelfUser(account.user, account), ...pair };
  }

  /**
   * Google OAuth (FR-02). Resolves the Google identity to a user — returning an
   * existing one, linking the provider to a same-email account, or provisioning a
   * brand-new passwordless `User + Account + OAuthAccount` — then issues tokens.
   */
  async oauthLogin(profile: GoogleProfile, retry = true): Promise<AuthResult> {
    // 1. Already linked to this Google identity → just log in.
    const linked = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: { provider: 'google', providerUserId: profile.providerUserId },
      },
      include: { account: { include: { user: true } } },
    });
    if (linked) {
      const pair = await this.tokens.issuePair(linked.account.userId);
      return { user: this.toSelfUser(linked.account.user, linked.account), ...pair };
    }

    // 2. A password account already owns this email → link Google to it.
    const byEmail = await this.prisma.account.findUnique({
      where: { email: profile.email },
      include: { user: true },
    });

    try {
      if (byEmail) {
        await this.prisma.oAuthAccount.create({
          data: {
            accountId: byEmail.id,
            provider: 'google',
            providerUserId: profile.providerUserId,
          },
        });
        const pair = await this.tokens.issuePair(byEmail.userId);
        return { user: this.toSelfUser(byEmail.user, byEmail), ...pair };
      }

      // 3. New user — passwordless account with a derived unique username.
      const username = await this.generateUniqueUsername(profile.email);
      const user = await this.prisma.user.create({
        data: {
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          account: {
            create: {
              username,
              email: profile.email,
              passwordHash: null,
              oauthAccounts: {
                create: { provider: 'google', providerUserId: profile.providerUserId },
              },
            },
          },
        },
        include: { account: true },
      });
      const pair = await this.tokens.issuePair(user.id);
      return { user: this.toSelfUser(user, user.account!), ...pair };
    } catch (e) {
      // A concurrent OAuth login won the race (link/email/username collision).
      // Re-resolve once: the linked row now exists.
      if (retry && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return this.oauthLogin(profile, false);
      }
      throw e;
    }
  }

  async refresh(userId: string, oldTokenId: string): Promise<TokenPair> {
    return this.tokens.rotateRefresh(userId, oldTokenId);
  }

  async logout(userId: string, rawRefreshToken: string | null, all: boolean): Promise<void> {
    if (all) {
      await this.tokens.revokeAllForUser(userId);
      return;
    }
    if (rawRefreshToken) {
      const token = await this.prisma.token.findUnique({
        where: { tokenHash: hashToken(rawRefreshToken) },
      });
      if (token && token.userId === userId) {
        await this.tokens.revoke(token.id);
      }
    }
  }

  /**
   * Derive a unique, contract-valid (`[a-z0-9_]`, 3–32 chars) username from an
   * email local-part, appending `_2`, `_3`, … until free.
   */
  private async generateUniqueUsername(email: string): Promise<string> {
    const local = email.split('@')[0] ?? 'user';
    let base = local.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (base.length < 3) base = `${base}user`;
    base = base.slice(0, 32);

    let candidate = base;
    let n = 2;
    while (await this.prisma.account.findUnique({ where: { username: candidate } })) {
      const suffix = `_${n}`;
      candidate = `${base.slice(0, 32 - suffix.length)}${suffix}`;
      n++;
    }
    return candidate;
  }

  private toSelfUser(user: UserProfile, account: { username: string; email: string }): SelfUser {
    return {
      id: user.id,
      username: account.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      presence: user.presence.toLowerCase() as SelfUser['presence'],
      email: account.email,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
