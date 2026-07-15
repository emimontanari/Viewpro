import { registerAs } from '@nestjs/config'

type NodeEnv = 'development' | 'test' | 'production'

export const appConfig = registerAs('app', () => {
  const nodeEnv = (process.env.NODE_ENV ?? 'development') as NodeEnv

  // No insecure default: a missing/blank secret means forgeable operator tokens.
  // Fail fast instead of silently signing with a well-known value.
  const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET
  if (!accessTokenSecret) {
    throw new Error(
      'ACCESS_TOKEN_SECRET is required and has no default. Set it in the environment.',
    )
  }

  // Required — control-lane secrets must be explicit at startup.
  const platformControlSecret = process.env.PLATFORM_CONTROL_SECRET
  if (!platformControlSecret) {
    throw new Error(
      'PLATFORM_CONTROL_SECRET is required and has no default. Set it in the environment.',
    )
  }

  // Required — distinct secret for the step-up ("sudo mode") re-auth cookie.
  // No insecure default: a missing/blank secret means forgeable step-up tokens.
  const stepUpTokenSecret = process.env.STEP_UP_TOKEN_SECRET
  if (!stepUpTokenSecret) {
    throw new Error(
      'STEP_UP_TOKEN_SECRET is required and has no default. Set it in the environment.',
    )
  }

  const inmoviewApiInternalUrl = process.env.INMOVIEW_API_INTERNAL_URL
  if (!inmoviewApiInternalUrl) {
    throw new Error(
      'INMOVIEW_API_INTERNAL_URL is required and has no default. Set it in the environment.',
    )
  }

  return {
    nodeEnv,
    port: Number(process.env.PORT ?? 3002),
    corsOrigin: process.env.CORS_ORIGIN,
    databaseUrl: process.env.DATABASE_URL,
    auth: {
      accessTokenSecret,
      idleTimeoutSeconds: Number(process.env.IDLE_TIMEOUT_SECONDS ?? 600),
      absoluteSessionSeconds: Number(process.env.ABSOLUTE_SESSION_SECONDS ?? 28800),
      stepUpTokenSecret,
      stepUpTtlSeconds: Number(process.env.STEP_UP_TTL_SECONDS ?? 300),
    },
    authRateLimit: {
      login: {
        limit: Number(process.env.AUTH_RATE_LIMIT_LOGIN_LIMIT ?? 5),
        ttlSeconds: Number(process.env.AUTH_RATE_LIMIT_LOGIN_TTL_SECONDS ?? 60),
      },
    },
    cookies: {
      domain: process.env.COOKIE_DOMAIN,
      // Force secure=true in production regardless of COOKIE_SECURE env var.
      // In development/test, respect the COOKIE_SECURE env var (defaults false via env schema).
      secure: nodeEnv === 'production' || process.env.COOKIE_SECURE === 'true',
    },
    platformControl: {
      secret: platformControlSecret,
      inmoviewApiInternalUrl,
    },
    platformData: {
      pollIntervalMs: Number(process.env.PLATFORM_POLL_INTERVAL_MS ?? 5000),
      // S2: batchLimit removed — batch size is producer-controlled (apps/api endpoint).
      // The consumer-side batchLimit was dead config that misled operators.
    },
  }
})
