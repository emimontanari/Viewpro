# ============================================
# Stage 1: Install workspace dependencies
# Build context: viewpro-app/
# Command: docker build -f apps/viewpro-web/Dockerfile -t viewpro-web .
# ============================================

ARG NODE_VERSION=22-slim
ARG PNPM_VERSION=10.13.1

FROM node:${NODE_VERSION} AS dependencies

ARG PNPM_VERSION

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter viewpro-web...

# ============================================
# Stage 2: Build the Next.js application
# ============================================

FROM node:${NODE_VERSION} AS builder

ARG PNPM_VERSION

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY --from=dependencies /app ./

WORKDIR /app/apps/viewpro-web

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV BUILD_STANDALONE=true

ARG NEXT_PUBLIC_SENTRY_DISABLED=true
ENV NEXT_PUBLIC_SENTRY_DISABLED=${NEXT_PUBLIC_SENTRY_DISABLED}

RUN pnpm build

# ============================================
# Stage 3: Production runner
# ============================================

FROM node:${NODE_VERSION} AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Monorepo standalone output nests the entry at apps/viewpro-web/server.js and
# hoists a shared node_modules to the standalone root (mapped here to /app).
COPY --from=builder --chown=node:node /app/apps/viewpro-web/.next/standalone ./

# Static assets and public/ must sit next to the nested server.js, not at /app.
COPY --from=builder --chown=node:node /app/apps/viewpro-web/.next/static ./apps/viewpro-web/.next/static
COPY --from=builder --chown=node:node /app/apps/viewpro-web/public ./apps/viewpro-web/public

USER node

EXPOSE 3000

CMD ["node", "apps/viewpro-web/server.js"]
