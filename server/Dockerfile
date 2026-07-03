# Dockerfile

# ── Stage 1: build ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# ── Stage 2: production ───────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# dumb-init forwards signals to node (PID 1) so Nest's enableShutdownHooks()
# receives SIGTERM and shuts down gracefully.
RUN apk add --no-cache dumb-init

COPY package*.json ./
RUN npm ci --omit=dev

# The Prisma client is generated into node_modules/.prisma by `prisma generate`
# in the builder; copy it over the freshly installed (dev-free) modules.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

# Drop root. The node:alpine image ships a non-root `node` user/group.
RUN chown -R node:node /app
USER node

EXPOSE 4000

# Liveness probe — proves the event loop is serving (does not touch deps).
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# nest build emits to dist/src/main.js (tsc preserves the src/ dir because
# prisma/seed.ts is also compiled) — matches the start:prod script.
CMD ["dumb-init", "node", "dist/src/main"]
