# syntax=docker/dockerfile:1.7

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

# Railway must build this Dockerfile with `viewpro-app` as the Docker context
# and `apps/api/Dockerfile` as the Dockerfile path.
COPY . .

RUN pnpm install --frozen-lockfile \
  && test -x node_modules/.bin/turbo \
  && node_modules/.bin/turbo run build --filter=@viewpro/api

FROM base AS runner

ENV NODE_ENV=production

WORKDIR /app

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/turbo.json ./turbo.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api ./apps/api
COPY --from=builder /app/packages ./packages

WORKDIR /app/apps/api

USER node

EXPOSE 3001

# Liveness probe (no DB dependency, so a transient DB blip never triggers a
# restart). Readiness with DB check is exposed separately at /api/health/ready
# for the load balancer / orchestrator to gate traffic.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3001/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Migrations and demo seed/reset are intentionally explicit deploy/runbook steps.
# Do not run `prisma migrate` or `demo:seed` from container startup.
CMD ["node", "dist/main.js"]
