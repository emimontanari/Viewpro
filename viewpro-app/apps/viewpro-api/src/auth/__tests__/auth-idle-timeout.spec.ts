import { describe, it, expect, beforeAll, afterAll } from 'vitest'
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

/**
 * T-07 — RED: AuthGuard threshold re-issue, sessionExp carry-forward, and
 * step-up invariance (D2/D5).
 *
 * Spec: Rolling Idle Deadline on Authenticated Activity; Absolute Session
 * Deadline (byte-identical carry-forward); Step-up Cookie Independence from
 * Access-Session Activity; Symmetric Cookie Clearing on Idle or Absolute
 * Expiry.
 *
 * GET /api/auth/me never touches the DB (see auth-me.controller.spec.ts),
 * so hand-signed tokens exercise the guard without seeding an operator.
 */

const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET ?? 'test-access-token-secret-min16'
const STEP_UP_TOKEN_SECRET =
  process.env.STEP_UP_TOKEN_SECRET ?? 'test-step-up-token-secret-min16'

const IDLE_TIMEOUT_SECONDS = 600 // default — matches env.schema.ts

function decode(token: string): Record<string, unknown> {
  const parts = token.split('.')
  return JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString('utf8'))
}

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
    exp: overrides.exp ?? nowSec + IDLE_TIMEOUT_SECONDS,
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

async function buildStepUpToken(sub: string) {
  const jwtService = new JwtService({ secret: STEP_UP_TOKEN_SECRET })
  return jwtService.signAsync({ sub, stepUp: true }, { expiresIn: 300 })
}

function extractAll(headers: Record<string, unknown>, name: string): string[] {
  const raw = headers['set-cookie'] as string[] | string | undefined
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : []
  return arr.filter((c) => c.startsWith(`${name}=`))
}

function extractCookieValue(setCookieHeader: string): string {
  const nameValue = setCookieHeader.split(';')[0] ?? ''
  const eqIndex = nameValue.indexOf('=')
  return nameValue.slice(eqIndex + 1)
}

function isCleared(setCookieHeader: string): boolean {
  const hasMaxAgeZero = /max-age=0/i.test(setCookieHeader)
  const expiresMatch = setCookieHeader.match(/expires=([^;]+)/i)
  const expiresValue = expiresMatch?.[1]
  const hasExpiredDate =
    expiresValue !== undefined && new Date(expiresValue).getTime() <= Date.now()
  return hasMaxAgeZero || hasExpiredDate
}

describe('GET /api/auth/me — idle-timeout re-issue, sessionExp carry-forward, step-up invariance', () => {
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
  })

  afterAll(async () => {
    await app.close()
  })

  it('iat past the 50% threshold, valid deadlines → 200 + a re-issued access Set-Cookie with the SAME sessionExp and fresh iat/exp (AC2/AC4/AC5)', async () => {
    const nowSec = Math.floor(Date.now() / 1000)
    const sessionExp = nowSec + 28800
    const token = await buildAccessToken({
      sub: 'op-threshold',
      email: 'threshold@viewpro.app',
      iat: nowSec - 400, // >= 300s threshold (600 * 0.5)
      exp: nowSec + 200,
      sessionExp,
    })

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `viewpro_platform_access_token=${token}; Path=/; HttpOnly`)

    expect(response.status).toBe(200)

    const accessSetCookies = extractAll(response.headers as Record<string, unknown>, 'viewpro_platform_access_token')
    expect(accessSetCookies).toHaveLength(1)
    const setCookieHeader = accessSetCookies[0] as string
    expect(/max-age=\d+/i.test(setCookieHeader)).toBe(true)
    expect(isCleared(setCookieHeader)).toBe(false)

    const reissuedToken = extractCookieValue(setCookieHeader)
    const reissuedPayload = decode(reissuedToken)
    expect(reissuedPayload.sessionExp).toBe(sessionExp)
    expect(reissuedPayload.iat).not.toBe(nowSec - 400)
    expect(reissuedPayload.exp).toBeGreaterThan(nowSec + 200)
  })

  it('fresh iat (< 300s since last sign) → 200, NO access-token Set-Cookie present (AC5 no-churn)', async () => {
    const nowSec = Math.floor(Date.now() / 1000)
    const token = await buildAccessToken({
      sub: 'op-fresh',
      email: 'fresh@viewpro.app',
      iat: nowSec,
      exp: nowSec + IDLE_TIMEOUT_SECONDS,
      sessionExp: nowSec + 28800,
    })

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `viewpro_platform_access_token=${token}; Path=/; HttpOnly`)

    expect(response.status).toBe(200)

    const accessSetCookies = extractAll(response.headers as Record<string, unknown>, 'viewpro_platform_access_token')
    expect(accessSetCookies).toHaveLength(0)
  })

  it('threshold re-issue alongside a valid step-up cookie: Set-Cookie names ONLY the access cookie, step-up cookie untouched (AC6)', async () => {
    const nowSec = Math.floor(Date.now() / 1000)
    const accessToken = await buildAccessToken({
      sub: 'op-stepup',
      email: 'stepup@viewpro.app',
      iat: nowSec - 400,
      exp: nowSec + 200,
      sessionExp: nowSec + 28800,
    })
    const stepUpToken = await buildStepUpToken('op-stepup')

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set(
        'Cookie',
        `viewpro_platform_access_token=${accessToken}; viewpro_platform_stepup_token=${stepUpToken}; Path=/; HttpOnly`,
      )

    expect(response.status).toBe(200)

    const accessSetCookies = extractAll(response.headers as Record<string, unknown>, 'viewpro_platform_access_token')
    expect(accessSetCookies).toHaveLength(1)

    const stepUpSetCookies = extractAll(response.headers as Record<string, unknown>, 'viewpro_platform_stepup_token')
    expect(stepUpSetCookies).toHaveLength(0)
  })

  it('a fresh, valid step-up cookie does NOT rescue an idle-expired access session (both cookies cleared)', async () => {
    const nowSec = Math.floor(Date.now() / 1000)
    const expiredAccessToken = await buildAccessToken({
      sub: 'op-idle-expired',
      email: 'idle-expired@viewpro.app',
      iat: nowSec - 700,
      exp: nowSec - 100, // well past CLOCK_TOLERANCE_SECONDS (5s)
      sessionExp: nowSec + 28800,
    })
    const stepUpToken = await buildStepUpToken('op-idle-expired')

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set(
        'Cookie',
        `viewpro_platform_access_token=${expiredAccessToken}; viewpro_platform_stepup_token=${stepUpToken}; Path=/; HttpOnly`,
      )

    expect(response.status).toBe(401)

    const accessSetCookies = extractAll(response.headers as Record<string, unknown>, 'viewpro_platform_access_token')
    const stepUpSetCookies = extractAll(response.headers as Record<string, unknown>, 'viewpro_platform_stepup_token')
    expect(accessSetCookies).toHaveLength(1)
    expect(stepUpSetCookies).toHaveLength(1)
    expect(isCleared(accessSetCookies[0] as string)).toBe(true)
    expect(isCleared(stepUpSetCookies[0] as string)).toBe(true)
  })

  it('idle-expired request (exp past): response clears BOTH access and step-up cookies (symmetric-clear regression)', async () => {
    const nowSec = Math.floor(Date.now() / 1000)
    const expiredAccessToken = await buildAccessToken({
      sub: 'op-symmetric',
      email: 'symmetric@viewpro.app',
      iat: nowSec - 700,
      exp: nowSec - 100,
      sessionExp: nowSec + 28800,
    })

    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `viewpro_platform_access_token=${expiredAccessToken}; Path=/; HttpOnly`)

    expect(response.status).toBe(401)

    const accessSetCookies = extractAll(response.headers as Record<string, unknown>, 'viewpro_platform_access_token')
    const stepUpSetCookies = extractAll(response.headers as Record<string, unknown>, 'viewpro_platform_stepup_token')
    expect(accessSetCookies).toHaveLength(1)
    expect(stepUpSetCookies).toHaveLength(1)
    expect(isCleared(accessSetCookies[0] as string)).toBe(true)
    expect(isCleared(stepUpSetCookies[0] as string)).toBe(true)
  })
})
