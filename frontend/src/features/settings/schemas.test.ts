// src/features/settings/schemas.test.ts
import { describe, it, expect } from 'vitest';
import {
  MAX_BIO,
  profileSchema,
  validateAvatarFile,
  MAX_AVATAR_BYTES,
} from './schemas';

describe('profileSchema', () => {
  it('accepts a valid display name and bio', () => {
    const result = profileSchema.safeParse({ displayName: 'Alice', bio: 'hi' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty display name', () => {
    const result = profileSchema.safeParse({ displayName: '   ', bio: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/required/i);
    }
  });

  it('rejects a bio longer than the max', () => {
    const result = profileSchema.safeParse({
      displayName: 'Alice',
      bio: 'x'.repeat(MAX_BIO + 1),
    });
    expect(result.success).toBe(false);
  });
});

function file(name: string, type: string, size: number): File {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

describe('validateAvatarFile', () => {
  it('accepts a small PNG', () => {
    expect(validateAvatarFile(file('a.png', 'image/png', 1000))).toBeNull();
  });

  it('rejects a non-image type', () => {
    expect(validateAvatarFile(file('a.pdf', 'application/pdf', 1000))).toMatch(
      /PNG|JPEG/i,
    );
  });

  it('rejects a file over the size limit', () => {
    expect(
      validateAvatarFile(file('big.png', 'image/png', MAX_AVATAR_BYTES + 1)),
    ).toMatch(/5 MB/i);
  });
});
