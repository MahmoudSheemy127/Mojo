---
name: prisma7-driver-adapter
description: This repo runs Prisma 7, which needs a driver adapter + prisma.config.ts (not the old schema url)
metadata:
  type: project
---

The project pins Prisma `^7.8.0`. Prisma 7 changed two things the design docs (written
pre-v7) don't reflect:

1. **No `url` in `schema.prisma`'s `datasource` block** — it's a validation error. The
   datasource URL for the CLI (migrate/generate/studio) lives in `prisma.config.ts`
   (`defineConfig({ datasource: { url: env('DATABASE_URL') } })`). That file calls
   `process.loadEnvFile()` to load `.env` locally.
2. **PrismaClient needs a driver adapter** for a direct connection. We use
   `@prisma/adapter-pg` (`PrismaPg`) — installed as a dep — instantiated in
   `src/prisma/prisma.service.ts`: `new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })`.

**Why:** without these, `prisma generate`/`validate` fail with P1012 and the client won't
connect. **How to apply:** keep the generator as `prisma-client-js`; never re-add `url` to the
schema; new modules just inject the existing global `PrismaService`. See [[be-qa-gate-workflow]].