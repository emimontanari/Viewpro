import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { ThrottlerModule } from '@nestjs/throttler'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { seedOperatorFixture } from '../../test-support/operator.fixture'
import { AuthModule } from '../auth.module'

/**
 * T-07 — RED: POST /auth/step-up integration tests.
 *
 * Spec: operator-step-up-auth — Step-up Endpoint — Password Re-verification
 *   (all 3 scenarios); D8 throttle bucket.
 */

const SEEDED_EMAIL = 'step-up-controller-test@viewpro.app'
const SEEDED_PASSWORD = 'step-up-controller-test-password'

function extractCookie(headers: Record<string, unknown>, name: string): string | undefined {
  const raw = headers['set-cookie'] as string[] | string | undefined
  const arr = Array.isArray(raw) ? raw : [raw ?? '']
  return arr.find((c) => c.startsWith(`${name}=`))
}

async function buildApp(throttleLimit: number): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule,
      ThrottlerModule.forRoot([{ ttl: 60_000, limit: throttleLimit }]),
      DatabaseModule,
      AuthModule,
    ],
  }).compile()

  const app = moduleFixture.createNestApplication()
  app.use(cookieParser())
  app.setGlobalPrefix('api')
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  await app.listen(0)
  return app
}

async function getAccessCookie(app: INestApplication): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: SEEDED_EMAIL, password: SEEDED_PASSWORD })
  if (res.status !== 200) {
    throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`)
  }
  const cookie = extractCookie(res.headers as Record<string, unknown>, 'viewpro_platform_access_token')
  return (cookie?.split(';')[0] ?? '').trim()
}

describe('POST /api/auth/step-up (integration)', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await buildApp(100)
    await seedOperatorFixture(app, { email: SEEDED_EMAIL, password: SEEDED_PASSWORD })
  })

  afterAll(async () => {
    await app.close()
  })

  it('correct current password → 200 + Set-Cookie for viewpro_platform_stepup_token (httpOnly)', async () => {
    const accessCookie = await getAccessCookie(app)

    const res = await request(app.getHttpServer())
      .post('/api/auth/step-up')
      .set('Cookie', accessCookie)
      .send({ password: SEEDED_PASSWORD })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ success: true })

    const stepUpCookie = extractCookie(res.headers as Record<string, unknown>, 'viewpro_platform_stepup_token')
    expect(stepUpCookie).toBeDefined()
    expect((stepUpCookie ?? '').toLowerCase()).toContain('httponly')
  })

  it('wrong password → 401, no viewpro_platform_stepup_token cookie set', async () => {
    const accessCookie = await getAccessCookie(app)

    const res = await request(app.getHttpServer())
      .post('/api/auth/step-up')
      .set('Cookie', accessCookie)
      .send({ password: 'definitely-wrong-password' })

    expect(res.status).toBe(401)
    const stepUpCookie = extractCookie(res.headers as Record<string, unknown>, 'viewpro_platform_stepup_token')
    expect(stepUpCookie).toBeUndefined()
  })

  it('no viewpro_platform_access_token cookie → 401, no LIVE step-up cookie set', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/step-up')
      .send({ password: SEEDED_PASSWORD })

    expect(res.status).toBe(401)
    // T-14 (D9/AC7): AuthGuard's failure path clears both cookies symmetrically,
    // so a `viewpro_platform_stepup_token=` header MAY be present, but only as
    // an expired clear (no live/valid step-up token is ever issued here).
    const stepUpCookie = extractCookie(res.headers as Record<string, unknown>, 'viewpro_platform_stepup_token')
    // The comment above is the contract: the header MAY be absent. Asserting
    // unconditionally would pin behaviour the endpoint does not promise, and
    // res.status is already asserted for every run.
    // oxlint-disable-next-line vitest/no-conditional-expect
    if (stepUpCookie) {
      const hasMaxAgeZero = /max-age=0/i.test(stepUpCookie)
      const expiresMatch = stepUpCookie.match(/expires=([^;]+)/i)
      const expiresValue = expiresMatch?.[1]
      const hasExpiredDate = expiresValue !== undefined && new Date(expiresValue).getTime() <= Date.now()
      // oxlint-disable-next-line vitest/no-conditional-expect
      expect(hasMaxAgeZero || hasExpiredDate).toBe(true)
    }
  })
})

describe('POST /api/auth/step-up — throttled (D8, AuthThrottlerGuard reused)', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await buildApp(5)
    await seedOperatorFixture(app, { email: SEEDED_EMAIL, password: SEEDED_PASSWORD })
  })

  afterAll(async () => {
    await app.close()
  })

  it('6th rapid attempt from the same IP within the throttle window → 429', async () => {
    const accessCookie = await getAccessCookie(app)

    let lastStatus = 0
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const res = await request(app.getHttpServer())
        .post('/api/auth/step-up')
        .set('Cookie', accessCookie)
        .send({ password: 'wrong-password' })
      lastStatus = res.status
    }

    expect(lastStatus).toBe(429)
  })
})
