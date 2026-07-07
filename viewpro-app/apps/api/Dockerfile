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

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @viewpro/api db:generate
RUN pnpm --filter @viewpro/api build

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

# Migrations and demo seed/reset are intentionally explicit deploy/runbook steps.
# Do not run `prisma migrate` or `demo:seed` from container startup.
CMD ["node", "dist/main.js"]
