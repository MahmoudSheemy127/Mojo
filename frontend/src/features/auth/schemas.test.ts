// src/features/auth/schemas.test.ts
import { describe, it, expect } from 'vitest';
import { loginSchema, signupSchema } from './schemas';

describe('loginSchema', () => {
  it('accepts a filled form', () => {
    expect(loginSchema.safeParse({ identifier: 'alice', password: 'x' }).success).toBe(
      true,
    );
  });

  it('rejects empty identifier/password', () => {
    expect(loginSchema.safeParse({ identifier: '', password: '' }).success).toBe(false);
  });
});

describe('signupSchema', () => {
  const valid = {
    username: 'alice_1',
    email: 'alice@example.com',
    password: 'longenough',
    confirmPassword: 'longenough',
    acceptedTerms: true as const,
  };

  it('accepts a valid form', () => {
    expect(signupSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects invalid username characters', () => {
    expect(signupSchema.safeParse({ ...valid, username: 'bad name!' }).success).toBe(
      false,
    );
  });

  it('rejects a short password', () => {
    const r = signupSchema.safeParse({ ...valid, password: 'short', confirmPassword: 'short' });
    expect(r.success).toBe(false);
  });

  it('rejects mismatched passwords', () => {
    const r = signupSchema.safeParse({ ...valid, confirmPassword: 'different' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path[0] === 'confirmPassword')).toBe(true);
    }
  });

  it('rejects an invalid email', () => {
    expect(signupSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false);
  });

  it('requires accepted terms', () => {
    expect(signupSchema.safeParse({ ...valid, acceptedTerms: false }).success).toBe(
      false,
    );
  });
});
