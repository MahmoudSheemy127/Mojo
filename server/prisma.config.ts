import { defineConfig, env } from 'prisma/config';

// Prisma 7 no longer reads the datasource URL from schema.prisma; the CLI
// (migrate / generate / studio) gets it from here. Load .env if present so
// `env('DATABASE_URL')` resolves locally; CI may inject the var directly.
try {
  process.loadEnvFile();
} catch {
  // .env is optional — ignore when absent.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
