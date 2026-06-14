// src/config/env.validation.ts
import { z } from 'zod';

/**
 * Zod schema validating process.env at boot. ConfigModule calls `validateEnv`
 * with the raw env object and aborts startup if anything required is missing or
 * malformed (fail-fast). Deferred features (Redis, Google OAuth) are optional.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1),

  // JWT — secrets must be long enough to be meaningful (NF-09 spirit)
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900), // ≤15 min (NF-10)
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2592000),

  // Cookies / CORS for the refresh-cookie flow
  WEB_ORIGIN: z.url(),
  COOKIE_DOMAIN: z.string().min(1),

  // Deferred (optional this round)
  REDIS_URL: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().optional(),

  // Observability — Sentry + log level. SENTRY_DSN absent ⇒ Sentry disabled.
  // Note: instrument.ts reads process.env directly (it runs before ConfigModule);
  // this schema validates/documents the same vars and feeds ConfigService.
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.enum(['development', 'staging', 'production']).default('development'),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
  SENTRY_PROFILES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
});

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = EnvSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}
