// src/config/env.validation.spec.ts
import { validateEnv } from './env.validation';

const BASE = {
  DATABASE_URL: 'postgresql://app:app@localhost:5432/chat',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  WEB_ORIGIN: 'http://localhost:5173',
  COOKIE_DOMAIN: 'localhost',
};

describe('validateEnv', () => {
  it('accepts a valid env and coerces numeric/defaulted fields', () => {
    const env = validateEnv({ ...BASE, PORT: '4000', JWT_ACCESS_TTL: '900' });
    expect(env.PORT).toBe(4000);
    expect(env.JWT_ACCESS_TTL).toBe(900);
    expect(env.JWT_REFRESH_TTL).toBe(2592000); // default applied
    expect(env.NODE_ENV).toBe('development'); // default applied
  });

  it('throws when a required secret is missing', () => {
    const { JWT_ACCESS_SECRET, ...withoutSecret } = BASE;
    void JWT_ACCESS_SECRET;
    expect(() => validateEnv(withoutSecret)).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('throws when a secret is too short', () => {
    expect(() => validateEnv({ ...BASE, JWT_ACCESS_SECRET: 'short' })).toThrow(/Invalid environment/);
  });

  it('throws when WEB_ORIGIN is not a URL', () => {
    expect(() => validateEnv({ ...BASE, WEB_ORIGIN: 'not-a-url' })).toThrow(/WEB_ORIGIN/);
  });
});
