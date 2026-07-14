import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSync } from 'node:child_process'
import { Test, TestingModule } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { ThrottlerModule } from '@nestjs/throttler'
import request from 'supertest'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { AuthModule } from '../auth.module'

// Operator seeded by this test suite
const SEEDED_EMAIL = 'auth-controller-test@viewpro.app'
const SEEDED_PASSWORD = 'auth-controller-test-password'

describe('AuthController (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    // Seed a known operator for this test suite
    execSync('pnpm db:seed', {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SEED_OPERATOR_EMAIL: SEEDED_EMAIL,
        SEED_OPERATOR_PASSWORD: SEEDED_PASSWORD,
      },
    })

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
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('POST /api/auth/login with valid credentials returns 200 + viewpro_platform_access_token cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: SEEDED_EMAIL, password: SEEDED_PASSWORD })

    expect(response.status).toBe(200)

    const setCookieHeader = response.headers['set-cookie'] as string[] | string | undefined
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader ?? '']
    const platformCookie = cookies.find((c) => c.startsWith('viewpro_platform_access_token='))
    expect(platformCookie).toBeDefined()
  })

  it('POST /api/auth/login with wrong password returns 401 and no Set-Cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: SEEDED_EMAIL, password: 'wrong-password' })

    expect(response.status).toBe(401)
    expect(response.headers['set-cookie']).toBeUndefined()
  })

  it('POST /api/auth/login with unknown email returns 401 and no Set-Cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'nobody@viewpro.app', password: 'any-password' })

    expect(response.status).toBe(401)
    expect(response.headers['set-cookie']).toBeUndefined()
  })

  it('Set-Cookie does NOT contain viewpro_access_token as standalone cookie name', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: SEEDED_EMAIL, password: SEEDED_PASSWORD })

    const setCookieHeader = response.headers['set-cookie'] as string[] | string | undefined
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader ?? '']
    const joined = cookies.join('\n')

    // Must not start with the InmoView cookie name
    expect(/^viewpro_access_token=/m.test(joined)).toBe(false)
  })

  it('viewpro_platform_access_token cookie has HttpOnly attribute', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: SEEDED_EMAIL, password: SEEDED_PASSWORD })

    const setCookieHeader = response.headers['set-cookie'] as string[] | string | undefined
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader ?? '']
    const platformCookie = cookies.find((c) => c.startsWith('viewpro_platform_access_token=')) ?? ''

    expect(platformCookie.toLowerCase()).toContain('httponly')
  })

  it('viewpro_platform_access_token cookie has SameSite=Lax attribute', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: SEEDED_EMAIL, password: SEEDED_PASSWORD })

    const setCookieHeader = response.headers['set-cookie'] as string[] | string | undefined
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader ?? '']
    const platformCookie = cookies.find((c) => c.startsWith('viewpro_platform_access_token=')) ?? ''

    expect(platformCookie.toLowerCase()).toContain('samesite=lax')
  })

  it('200 response body contains operator id and email but no passwordHash', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: SEEDED_EMAIL, password: SEEDED_PASSWORD })

    expect(response.status).toBe(200)
    expect(response.body.operator).toBeDefined()
    expect(typeof response.body.operator.id).toBe('string')
    expect(response.body.operator.email).toBe(SEEDED_EMAIL)
    expect(response.body.operator).not.toHaveProperty('passwordHash')
  })

  it('POST /api/auth/logout returns 200 with { success: true }', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/logout')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ success: true })
  })

  it('POST /api/auth/logout clears viewpro_platform_access_token cookie (maxAge=0 or expires in past)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/logout')

    const setCookieHeader = response.headers['set-cookie'] as string[] | string | undefined
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader ?? '']
    const platformCookie = cookies.find((c) => c.startsWith('viewpro_platform_access_token=')) ?? ''

    // clearCookie sets maxAge=0 (or Expires to epoch) to instruct the browser to delete the cookie
    const hasMaxAgeZero = /max-age=0/i.test(platformCookie)
    const expiresMatch = platformCookie.match(/expires=([^;]+)/i)
    const expiresValue = expiresMatch?.[1]
    const hasExpiredDate = expiresValue !== undefined && new Date(expiresValue).getTime() <= Date.now()

    expect(hasMaxAgeZero || hasExpiredDate).toBe(true)
  })

  it('POST /api/auth/logout is idempotent — works without a session cookie (no 401)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/logout')
      // No cookie attached — should still succeed (unguarded endpoint)

    expect(response.status).toBe(200)
  })
})
