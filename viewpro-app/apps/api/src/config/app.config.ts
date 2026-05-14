import { registerAs } from '@nestjs/config'

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3001),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL,
  auth: {
    accessTokenSecret: process.env.ACCESS_TOKEN_SECRET ?? 'change-me-in-real-env',
    accessTokenTtlSeconds: Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900),
    refreshTokenTtlSeconds: Number(process.env.REFRESH_TOKEN_TTL_SECONDS ?? 2592000),
  },
  cookies: {
    domain: process.env.COOKIE_DOMAIN,
    secure: process.env.COOKIE_SECURE === 'true',
  },
}))
