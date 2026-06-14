// src/common/utils/hash.ts
import * as argon2 from 'argon2';
import { createHash } from 'node:crypto';

/**
 * Password hashing — argon2id (NF-09). Never store or log plaintext.
 */
export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}

/**
 * Token hashing — a fast, deterministic SHA-256 used as the unique lookup key
 * stored in `Token.tokenHash`. Deterministic (unlike argon2) so a presented
 * refresh/reset token can be found by `where: { tokenHash }`. The raw token is
 * high-entropy random, so SHA-256 is appropriate here (no salting needed).
 */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}
