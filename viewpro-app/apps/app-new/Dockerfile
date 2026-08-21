# ============================================
# Stage 1: Install workspace dependencies
# Build context: viewpro-app/
# Command: docker build -f apps/app-new/Dockerfile -t viewpro-app-new .
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
    pnpm install --frozen-lockfile --filter next-shadcn-dashboard-starter...

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

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV BUILD_STANDALONE=true

ARG NEXT_PUBLIC_SENTRY_DISABLED=true
ENV NEXT_PUBLIC_SENTRY_DISABLED=${NEXT_PUBLIC_SENTRY_DISABLED}

RUN test -x /app/node_modules/.bin/turbo && pnpm --filter @viewpro/contracts build && pnpm --filter next-shadcn-dashboard-starter build

# ============================================
# Stage 3: Production runner
# ============================================

FROM node:${NODE_VERSION} AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Copy public assets
COPY --from=builder --chown=node:node /app/apps/app-new/public ./apps/app-new/public

# Copy standalone output and static files
COPY --from=builder --chown=node:node /app/apps/app-new/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/app-new/.next/static ./apps/app-new/.next/static

USER node

EXPOSE 3000

# Liveness: the Next server responds at all (root redirects to sign-in → <400).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/',r=>process.exit(r.statusCode<400?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "apps/app-new/server.js"]
