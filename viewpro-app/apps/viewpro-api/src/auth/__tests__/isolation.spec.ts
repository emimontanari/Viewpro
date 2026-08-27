import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { ThrottlerModule } from '@nestjs/throttler'
import { JwtService } from '@nestjs/jwt'
import request from 'supertest'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { seedOperatorFixture } from '../../test-support/operator.fixture'
import { AuthModule } from '../auth.module'

const ISOLATION_EMAIL = 'isolation-test@viewpro.app'
const ISOLATION_PASSWORD = 'isolation-test-password'

const INMOVIEW_SECRET = 'completely-different-inmoview-secret'

describe('Isolation regression — InmoView DB unset, own JWT secret', () => {
  let app: INestApplication

  beforeAll(async () => {
    // Ensure no InmoView DB env vars are set (belt-and-suspenders over setup-env.ts)
    delete process.env.INMV_DATABASE_URL

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule,
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
        DatabaseModule,
        AuthModule,
      ],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.listen(0)
    await seedOperatorFixture(app, { email: ISOLATION_EMAIL, password: ISOLATION_PASSWORD })
  })

  afterAll(async () => {
    await app?.close()
  })

  it('sign-in succeeds even when INMV_DATABASE_URL is not set', async () => {
    // InmoView DB env must be absent
    expect(process.env.INMV_DATABASE_URL).toBeUndefined()

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: ISOLATION_EMAIL, password: ISOLATION_PASSWORD })

    expect(response.status).toBe(200)

    const setCookieHeader = response.headers['set-cookie'] as string[] | string | undefined
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader ?? '']
    const platformCookie = cookies.find((c) => c.startsWith('viewpro_platform_access_token='))
    expect(platformCookie).toBeDefined()
  })

  it('JWT issued by platform cannot be verified with InmoView secret', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: ISOLATION_EMAIL, password: ISOLATION_PASSWORD })

    const setCookieHeader = response.headers['set-cookie'] as string[] | string | undefined
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader ?? '']
    const platformCookieStr = cookies.find((c) => c.startsWith('viewpro_platform_access_token=')) ?? ''
    const token = (platformCookieStr.split(';')[0] ?? '').replace('viewpro_platform_access_token=', '')

    // JwtService with InmoView secret should reject the platform token
    const inmoviewJwtService = new JwtService({ secret: INMOVIEW_SECRET })
    await expect(inmoviewJwtService.verifyAsync(token)).rejects.toThrow()
  })

  it('Set-Cookie cookie name is exactly viewpro_platform_access_token', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: ISOLATION_EMAIL, password: ISOLATION_PASSWORD })

    const setCookieHeader = response.headers['set-cookie'] as string[] | string | undefined
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader ?? '']
    const joined = cookies.join('\n')

    // Must have platform cookie
    expect(/^viewpro_platform_access_token=/m.test(joined)).toBe(true)
    // Must NOT have InmoView cookie name
    expect(/^viewpro_access_token=/m.test(joined)).toBe(false)
  })
})
