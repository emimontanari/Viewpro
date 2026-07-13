import { registerAs } from '@nestjs/config'

type NodeEnv = 'development' | 'test' | 'production'

type SentryEnvironment = Record<string, string | undefined>

export type AuthRateLimitConfig = {
  limit: number
  ttlSeconds: number
}

export function parseCorsOrigins(corsOrigin: string | undefined, nodeEnv: NodeEnv) {
  const rawOrigin = corsOrigin ?? (nodeEnv === 'production' ? undefined : 'http://localhost:3000')
  const rawOrigins = rawOrigin?.split(',').map((origin) => origin.trim()) ?? []

  if (
    nodeEnv === 'production' &&
    (rawOrigins.length === 0 || rawOrigins.some((origin) => origin.length === 0 || origin.includes('*')))
  ) {
    throw new Error('CORS_ORIGIN must contain explicit origins in production')
  }

  return rawOrigins.filter(Boolean)
}

export function getAppPublicUrl(appPublicUrl: string | undefined, nodeEnv: NodeEnv) {
  const rawUrl = appPublicUrl ?? (nodeEnv === 'production' ? undefined : 'http://localhost:3000')

  if (!rawUrl) {
    throw new Error('APP_PUBLIC_URL must be configured in production')
  }

  return rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl
}

export function getAuthRateLimitConfig(): {
  login: AuthRateLimitConfig
  register: AuthRateLimitConfig
  refresh: AuthRateLimitConfig
} {
  return {
    login: {
      limit: Number(process.env.AUTH_RATE_LIMIT_LOGIN_LIMIT ?? 5),
      ttlSeconds: Number(process.env.AUTH_RATE_LIMIT_LOGIN_TTL_SECONDS ?? 60),
    },
    register: {
      limit: Number(process.env.AUTH_RATE_LIMIT_REGISTER_LIMIT ?? 3),
      ttlSeconds: Number(process.env.AUTH_RATE_LIMIT_REGISTER_TTL_SECONDS ?? 60),
    },
    refresh: {
      limit: Number(process.env.AUTH_RATE_LIMIT_REFRESH_LIMIT ?? 20),
      ttlSeconds: Number(process.env.AUTH_RATE_LIMIT_REFRESH_TTL_SECONDS ?? 60),
    },
  }
}

export function getSentryConfig(nodeEnv: NodeEnv, env: SentryEnvironment = process.env) {
  const tracesSampleRate = Number(env.SENTRY_TRACES_SAMPLE_RATE ?? 0)

  if (tracesSampleRate < 0 || tracesSampleRate > 1) {
    throw new Error('SENTRY_TRACES_SAMPLE_RATE must be between 0 and 1')
  }

  return {
    dsn: env.SENTRY_DSN || undefined,
    environment: env.SENTRY_ENVIRONMENT ?? nodeEnv,
    tracesSampleRate,
  }
}

export const appConfig = registerAs('app', () => {
  const nodeEnv = (process.env.NODE_ENV ?? 'development') as NodeEnv

  return {
    nodeEnv,
    port: Number(process.env.PORT ?? 3001),
    publicUrl: getAppPublicUrl(process.env.APP_PUBLIC_URL, nodeEnv),
    cors: {
      origins: parseCorsOrigins(process.env.CORS_ORIGIN, nodeEnv),
    },
    databaseUrl: process.env.DATABASE_URL,
    auth: {
      accessTokenSecret: process.env.ACCESS_TOKEN_SECRET ?? 'change-me-in-real-env',
      accessTokenTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900),
      refreshTokenTtlSeconds: Number(process.env.REFRESH_TOKEN_TTL_SECONDS ?? 2592000),
    },
    authRateLimit: getAuthRateLimitConfig(),
    cookies: {
      domain: process.env.COOKIE_DOMAIN,
      secure: process.env.COOKIE_SECURE === 'true',
    },
    email: {
      apiKey: process.env.RESEND_API_KEY,
      fromAddress: process.env.EMAIL_FROM_ADDRESS ?? 'no-reply@inmoview.app',
    },
    sentry: getSentryConfig(nodeEnv),
  }
})
