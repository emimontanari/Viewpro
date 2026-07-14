import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { execSync } from 'node:child_process'
import { Test, TestingModule } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { ThrottlerModule } from '@nestjs/throttler'
import { JwtService } from '@nestjs/jwt'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { AuthModule } from '../auth.module'
import { LoginUseCase } from '../use-cases/login.use-case'

// Operator seeded by this test suite
const SEEDED_EMAIL = 'auth-me-test@viewpro.app'
const SEEDED_PASSWORD = 'auth-me-test-password'

// Must match ACCESS_TOKEN_SECRET set in the test env (see vitest.setup-env.ts)
const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET ?? 'test-access-token-secret-min16'

// Build an already-expired token using a separate JwtService with negative expiresIn
async function buildExpiredToken(payload: { sub: string; email: string }) {
  const jwtService = new JwtService({ secret: ACCESS_TOKEN_SECRET })
  return jwtService.signAsync(payload, { expiresIn: -1 })
}

describe('GET /api/auth/me', () => {
  let app: INestApplication

  beforeAll(async () => {
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
    app.use(cookieParser())
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  // Scenario 1: Valid cookie → 200 + { operator: { id, email } }
  it('GET /api/auth/me with valid cookie returns 200 + operator identity', async () => {
    // First login to get a real token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: SEEDED_EMAIL, password: SEEDED_PASSWORD })

    expect(loginResponse.status).toBe(200)

    const setCookieHeader = loginResponse.headers['set-cookie'] as
      | string[]
      | string
      | undefined
    const cookies = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : [setCookieHeader ?? '']
    const platformCookieStr =
      cookies.find((c) => c.startsWith('viewpro_platform_access_token=')) ?? ''

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', platformCookieStr)

    expect(response.status).toBe(200)
    expect(response.body.operator).toBeDefined()
    expect(typeof response.body.operator.id).toBe('string')
    expect(response.body.operator.email).toBe(SEEDED_EMAIL)
  })

  // Scenario 2: Missing cookie → 401
  it('GET /api/auth/me without cookie returns 401 and no operator data', async () => {
    const response = await request(app.getHttpServer()).get('/api/auth/me')

    expect(response.status).toBe(401)
    expect(response.body.operator).toBeUndefined()
  })

  // Scenario 3: Expired/tampered cookie → 401
  it('GET /api/auth/me with expired token returns 401 and no operator data', async () => {
    const expiredToken = await buildExpiredToken({
      sub: 'some-id',
      email: 'expired@viewpro.app',
    })

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set(
        'Cookie',
        `viewpro_platform_access_token=${expiredToken}; Path=/; HttpOnly`,
      )

    expect(response.status).toBe(401)
    expect(response.body.operator).toBeUndefined()
  })

  // Scenario 3b: Tampered/invalid token → 401
  it('GET /api/auth/me with tampered token returns 401', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', 'viewpro_platform_access_token=invalid.tampered.token; Path=/; HttpOnly')

    expect(response.status).toBe(401)
    expect(response.body.operator).toBeUndefined()
  })

  // Additive regression: existing POST /api/auth/login unaffected
  it('POST /api/auth/login still returns 200 after GET /auth/me addition', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: SEEDED_EMAIL, password: SEEDED_PASSWORD })

    expect(response.status).toBe(200)
    expect(response.body.operator).toBeDefined()
    expect(response.body.operator.email).toBe(SEEDED_EMAIL)
  })

  // No DB query: spy on the LoginUseCase (the only component touching the DB in auth).
  // GET /auth/me must succeed without touching the use case (no DB call).
  it('GET /api/auth/me does NOT call any Prisma/database method', async () => {
    const loginUseCase = app.get(LoginUseCase)
    const executeSpy = vi.spyOn(loginUseCase, 'execute')

    // First login to get a real token (this WILL call the DB via LoginUseCase)
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: SEEDED_EMAIL, password: SEEDED_PASSWORD })

    const setCookieHeader = loginResponse.headers['set-cookie'] as
      | string[]
      | string
      | undefined
    const cookies = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : [setCookieHeader ?? '']
    const platformCookieStr =
      cookies.find((c) => c.startsWith('viewpro_platform_access_token=')) ?? ''
    // Extract only the name=value part (omit Path, HttpOnly, SameSite attributes)
    const cookieValue = (platformCookieStr.split(';')[0] ?? '').trim()

    // Reset spy counts after login
    executeSpy.mockClear()

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookieValue)

    expect(response.status).toBe(200)
    // LoginUseCase.execute is the only path to the DB in auth; it must NOT be called
    expect(executeSpy).not.toHaveBeenCalled()

    executeSpy.mockRestore()
  })
})
