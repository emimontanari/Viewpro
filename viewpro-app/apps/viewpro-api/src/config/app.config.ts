import { registerAs } from '@nestjs/config'

type NodeEnv = 'development' | 'test' | 'production'

export const appConfig = registerAs('app', () => {
  const nodeEnv = (process.env.NODE_ENV ?? 'development') as NodeEnv

  return {
    nodeEnv,
    port: Number(process.env.PORT ?? 3002),
    corsOrigin: process.env.CORS_ORIGIN,
    databaseUrl: process.env.DATABASE_URL,
    auth: {
      accessTokenSecret: process.env.ACCESS_TOKEN_SECRET ?? 'change-me-in-real-env',
      accessTokenTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900),
    },
    authRateLimit: {
      login: {
        limit: Number(process.env.AUTH_RATE_LIMIT_LOGIN_LIMIT ?? 5),
        ttlSeconds: Number(process.env.AUTH_RATE_LIMIT_LOGIN_TTL_SECONDS ?? 60),
      },
    },
    cookies: {
      domain: process.env.COOKIE_DOMAIN,
      secure: process.env.COOKIE_SECURE === 'true',
    },
  }
})
