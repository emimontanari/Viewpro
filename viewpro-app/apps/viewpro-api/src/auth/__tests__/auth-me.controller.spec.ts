import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { UnauthorizedException, ValidationPipe } from '@nestjs/common'
import { ThrottlerModule } from '@nestjs/throttler'
import { JwtService } from '@nestjs/jwt'
import type { Operator } from '@prisma-platform/client'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { seedOperatorFixture } from '../../test-support/operator.fixture'
import { AuthController } from '../auth.controller'
import { AuthModule } from '../auth.module'
import type { AuthenticatedRequest } from '../guards/auth.guard'
import type { IOperatorRepository } from '../repositories/operator.repository'
import { LoginUseCase } from '../use-cases/login.use-case'

// Operator seeded by this test suite
const SEEDED_EMAIL = 'auth-me-test@viewpro.app'
const SEEDED_PASSWORD = 'auth-me-test-password'

// Must match ACCESS_TOKEN_SECRET set in the test env (see vitest.setup-env.ts)
const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET ?? 'test-access-token-secret-min16'

// Builds an access token with fully explicit iat/exp/sessionExp claims —
// deterministic, no fake timers. An explicit numeric `iat` in the payload is
// preserved by jsonwebtoken's sign() (see the inline note below); omitting
// `sessionExp` from the overrides signs a legacy token without the
// absolute-deadline claim (AC9).
async function buildAccessToken(overrides: {
  sub: string
  email: string
  iat?: number
  exp?: number
  sessionExp?: number
}) {
  const jwtService = new JwtService({ secret: ACCESS_TOKEN_SECRET })
  const nowSec = Math.floor(Date.now() / 1000)
  const payload: Record<string, unknown> = {
    sub: overrides.sub,
    email: overrides.email,
    iat: overrides.iat ?? nowSec,
    exp: overrides.exp ?? nowSec + 600,
  }
  if (overrides.sessionExp !== undefined) {
    payload.sessionExp = overrides.sessionExp
  }
  // No `noTimestamp` option: jsonwebtoken's sign() computes
  // `timestamp = payload.iat || now()` and only overwrites `payload.iat`
  // when NOT set — an explicit numeric `iat` in the payload is preserved
  // as-is. `noTimestamp: true` would instead unconditionally DELETE
  // `payload.iat` (jsonwebtoken sign.js), destroying the explicit value.
  return jwtService.signAsync(payload)
}

describe('GET /api/auth/me', () => {
  let app: INestApplication

  beforeAll(async () => {
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
    await seedOperatorFixture(app, { email: SEEDED_EMAIL, password: SEEDED_PASSWORD })
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
    // Cross-service contract (JD hardening): the AuthGuard 401 body carries a
    // stable machine-readable code so the FE distinguishes session-expiry from
    // a wrong-password 401 without string-matching the human message.
    expect(response.body.code).toBe('AUTH_REQUIRED')
  })

  // Scenario 3: Expired (idle) token, valid future sessionExp → 401 (idle wins)
  it('GET /api/auth/me with an idle-expired token returns 401 and no operator data', async () => {
    const nowSec = Math.floor(Date.now() / 1000)
    const expiredToken = await buildAccessToken({
      sub: 'some-id',
      email: 'expired@viewpro.app',
      iat: nowSec - 700,
      exp: nowSec - 100, // well past CLOCK_TOLERANCE_SECONDS (5s)
      sessionExp: nowSec + 28800, // absolute deadline still far away
    })

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set(
        'Cookie',
        `viewpro_platform_access_token=${expiredToken}; Path=/; HttpOnly`,
      )

    expect(response.status).toBe(401)
    expect(response.body.operator).toBeUndefined()
    expect(response.body.code).toBe('AUTH_REQUIRED')
  })

  // Scenario 3b: Tampered/invalid token → 401
  it('GET /api/auth/me with tampered token returns 401', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', 'viewpro_platform_access_token=invalid.tampered.token; Path=/; HttpOnly')

    expect(response.status).toBe(401)
    expect(response.body.operator).toBeUndefined()
    expect(response.body.code).toBe('AUTH_REQUIRED')
  })

  // KEY new case (AC3): valid sliding exp, but sessionExp already past → 401
  it('GET /api/auth/me with a valid sliding exp but a past sessionExp returns 401 (absolute deadline)', async () => {
    const nowSec = Math.floor(Date.now() / 1000)
    const token = await buildAccessToken({
      sub: 'some-id',
      email: 'absolute-expired@viewpro.app',
      iat: nowSec - 10,
      exp: nowSec + 600, // sliding exp still valid
      sessionExp: nowSec - 10, // absolute deadline already past
    })

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `viewpro_platform_access_token=${token}; Path=/; HttpOnly`)

    expect(response.status).toBe(401)
    expect(response.body.operator).toBeUndefined()
    expect(response.body.code).toBe('AUTH_REQUIRED')
  })

  // Legacy/AC9: a token signed without a sessionExp claim is treated as expired
  it('GET /api/auth/me with a token lacking the sessionExp claim returns 401 (not grandfathered)', async () => {
    const nowSec = Math.floor(Date.now() / 1000)
    const token = await buildAccessToken({
      sub: 'some-id',
      email: 'legacy@viewpro.app',
      iat: nowSec - 10,
      exp: nowSec + 600,
      // sessionExp intentionally omitted
    })

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `viewpro_platform_access_token=${token}; Path=/; HttpOnly`)

    expect(response.status).toBe(401)
    expect(response.body.operator).toBeUndefined()
    expect(response.body.code).toBe('AUTH_REQUIRED')
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

  // GET /auth/me re-checks the operator's CURRENT status (session-terminating
  // hardening), but must NOT run the login use case. LoginUseCase.execute is
  // the login/authentication path — /me only reads the operator row.
  it('GET /api/auth/me does NOT invoke the login use case', async () => {
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
    // The login use case must NOT be invoked by /me.
    expect(executeSpy).not.toHaveBeenCalled()

    executeSpy.mockRestore()
  })
})

// Unit-level coverage of the session-terminating status re-check in getMe.
// A valid access token no longer implies an ACTIVE session: a SUSPENDED or
// removed operator must receive a 401 AUTH_REQUIRED so the FE logs them out.
describe('AuthController.getMe — operator status enforcement (unit)', () => {
  const makeOperator = (overrides: Partial<Operator> = {}): Operator => ({
    id: 'op-me-1',
    email: 'me@viewpro.app',
    passwordHash: '$argon2id$hashed',
    status: 'ACTIVE',
    role: 'OWNER',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })

  const makeController = (findByIdResult: Operator | null) => {
    const operatorRepository: IOperatorRepository = {
      findById: vi.fn().mockResolvedValue(findByIdResult),
      findByEmail: vi.fn(),
      create: vi.fn(),
      list: vi.fn(),
      updateRole: vi.fn(),
      updateStatus: vi.fn(),
      countActiveOwners: vi.fn(),
    }
    const controller = new AuthController(
      undefined as never,
      undefined as never,
      undefined as never,
      operatorRepository,
    )
    return { controller, operatorRepository }
  }

  const req = (id: string, email: string) =>
    ({ user: { id, email } }) as AuthenticatedRequest

  // T1.4.2 — updated: getMe() now additionally returns `role` (id/email
  // remain unchanged; this is an additive shape change, not a regression).
  it('ACTIVE operator → returns { operator: { id, email, role } }', async () => {
    const { controller } = makeController(
      makeOperator({ id: 'op-me-1', email: 'me@viewpro.app', role: 'OWNER' }),
    )

    const result = await controller.getMe(req('op-me-1', 'me@viewpro.app'))

    expect(result).toEqual({ operator: { id: 'op-me-1', email: 'me@viewpro.app', role: 'OWNER' } })
  })

  // T1.4.1 — RED: role reflects the actual DB role, not a hardcoded default.
  it('ACTIVE ANALYST operator → role reflects the actual DB role, not a hardcoded default', async () => {
    const { controller } = makeController(
      makeOperator({ id: 'op-me-2', email: 'analyst@viewpro.app', role: 'ANALYST' }),
    )

    const result = await controller.getMe(req('op-me-2', 'analyst@viewpro.app'))

    expect(result).toEqual({ operator: { id: 'op-me-2', email: 'analyst@viewpro.app', role: 'ANALYST' } })
  })

  it('SUSPENDED operator (valid token) → 401 UnauthorizedException with code AUTH_REQUIRED', async () => {
    const { controller } = makeController(makeOperator({ status: 'SUSPENDED' }))

    const error = await controller
      .getMe(req('op-me-1', 'me@viewpro.app'))
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(UnauthorizedException)
    expect((error as UnauthorizedException).getResponse()).toMatchObject({
      statusCode: 401,
      code: 'AUTH_REQUIRED',
    })
  })

  it('operator row no longer exists → 401 UnauthorizedException with code AUTH_REQUIRED', async () => {
    const { controller } = makeController(null)

    const error = await controller
      .getMe(req('gone', 'gone@viewpro.app'))
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(UnauthorizedException)
    expect((error as UnauthorizedException).getResponse()).toMatchObject({
      statusCode: 401,
      code: 'AUTH_REQUIRED',
    })
  })
})
