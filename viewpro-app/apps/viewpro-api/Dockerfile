# syntax=docker/dockerfile:1.7

# Build context: viewpro-app/  ·  Dockerfile path: apps/viewpro-api/Dockerfile
# Command: docker build -f apps/viewpro-api/Dockerfile -t viewpro-platform-api .

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@10.13.1 --activate

WORKDIR /app

FROM base AS builder

COPY . .

RUN pnpm install --frozen-lockfile
# db:generate must run before build: `build` copies src/generated -> dist/generated.
RUN pnpm --filter @viewpro/platform-api db:generate
RUN pnpm --filter @viewpro/platform-api build

FROM base AS runner

ENV NODE_ENV=production

WORKDIR /app

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/turbo.json ./turbo.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/viewpro-api ./apps/viewpro-api
COPY --from=builder /app/packages ./packages

WORKDIR /app/apps/viewpro-api

USER node

EXPOSE 3002

# Liveness probe (no DB dependency). Readiness with DB check lives at
# /api/health/ready for the load balancer / orchestrator to gate traffic.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3002/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Migrations are an explicit deploy/runbook step (pnpm db:platform:migrate).
# Do not run `prisma migrate` from container startup.
CMD ["node", "dist/main.js"]
