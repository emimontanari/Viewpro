import { registerAs } from '@nestjs/config'

type NodeEnv = 'development' | 'test' | 'production'

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

export const appConfig = registerAs('app', () => {
  const nodeEnv = (process.env.NODE_ENV ?? 'development') as NodeEnv

  return {
    nodeEnv,
    port: Number(process.env.PORT ?? 3001),
    cors: {
      origins: parseCorsOrigins(process.env.CORS_ORIGIN, nodeEnv),
    },
    corsOrigin: process.env.CORS_ORIGIN ?? (nodeEnv === 'production' ? undefined : 'http://localhost:3000'),
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
  }
})
