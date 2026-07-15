import type { INestApplication } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// T-13 follow-up — change-feed trust-isolation + read-only invariant
//
// Spec: platform-data-lane-outbox — Invariants: read-only endpoint; secret
//       not logged; token confusion threat
//
// Scenarios:
//   1. Product user JWT (no valid service token) → 401; request.user NEVER set
//      on this path (the guard sets platformCaller only, never request.user).
//   2. Valid service token → 200; response body does NOT contain
//      PLATFORM_CONTROL_SECRET or the raw token string.
//   3. GET /internal/platform/changes is read-only: calling it does NOT create
//      or alter any platform_outbox_events rows.
// ---------------------------------------------------------------------------

const PLATFORM_CONTROL_SECRET = process.env.PLATFORM_CONTROL_SECRET ?? 'test-platform-control-secret-min16'
const USER_ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET ?? 'test-access-token-secret'

process.env.PLATFORM_CONTROL_SECRET = PLATFORM_CONTROL_SECRET

const serviceSigner = new JwtService({ secret: PLATFORM_CONTROL_SECRET })
const userSigner = new JwtService({ secret: USER_ACCESS_SECRET })

async function mintServiceToken(): Promise<string> {
  return serviceSigner.signAsync(
    { iss: 'viewpro-api', aud: 'inmoview-control', sub: 'system-ingest', jti: `jti-${Date.now()}` },
    { expiresIn: '120s' },
  )
}

async function mintUserToken(): Promise<string> {
  // A valid product user JWT — signed with a different secret, no aud=inmoview-control.
  return userSigner.signAsync(
    { sub: 'user-abc', email: 'user@example.com' },
    { expiresIn: '900s' },
  )
}

describe('Change-Feed — trust-isolation + read-only invariants', () => {
  let app: INestApplication
  let prisma: import('@prisma/client').PrismaClient

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.PLATFORM_CONTROL_SECRET = PLATFORM_CONTROL_SECRET

    const { createApiApp } = await import('../../bootstrap/create-app.js')
    app = await createApiApp()
    await app.init()

    const { PrismaService } = await import('../../database/prisma.service.js')
    prisma = app.get(PrismaService)
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    // Clean outbox so count-before assertions are deterministic.
    await prisma.platformOutboxEvent.deleteMany()
  })

  // -------------------------------------------------------------------------
  // Scenario 1: Product user JWT → 401; request.user NEVER set on this path
  //
  // PlatformControlGuard verifies aud=inmoview-control and the PLATFORM_CONTROL_SECRET.
  // A user JWT uses USER_ACCESS_SECRET and has no aud claim → guard must reject it.
  // The controller is never reached so request.user is never populated.
  // -------------------------------------------------------------------------
  it('user JWT cookie/bearer (no valid service token) → 401 on the change-feed route', async () => {
    const userToken = await mintUserToken()

    // Bearer with user token — wrong secret, wrong aud
    const res = await request(app.getHttpServer())
      .get('/api/internal/platform/changes?since=0')
      .set('Authorization', `Bearer ${userToken}`)

    expect(res.status).toBe(401)
  })

  it('request.user is NEVER set by PlatformControlGuard (guard rejects user token, response carries no user info)', async () => {
    const userToken = await mintUserToken()

    const res = await request(app.getHttpServer())
      .get('/api/internal/platform/changes?since=0')
      .set('Authorization', `Bearer ${userToken}`)

    // If the guard were to mistakenly set request.user and let it through,
    // the status would be 200 and/or user data would appear. 401 proves
    // the guard stopped execution before any user identity was established.
    expect(res.status).toBe(401)
    // Body must not contain any user sub or email from the submitted JWT.
    const bodyStr = JSON.stringify(res.body)
    expect(bodyStr).not.toContain('user-abc')
    expect(bodyStr).not.toContain('user@example.com')
  })

  // -------------------------------------------------------------------------
  // Scenario 2: Valid service token → 200; secret not leaked in response
  // -------------------------------------------------------------------------
  it('valid service token → 200 and response body does NOT contain PLATFORM_CONTROL_SECRET', async () => {
    const token = await mintServiceToken()

    const res = await request(app.getHttpServer())
      .get('/api/internal/platform/changes?since=0')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)

    // The raw secret must never appear in any response body or header value.
    const bodyStr = JSON.stringify(res.body)
    expect(bodyStr).not.toContain(PLATFORM_CONTROL_SECRET)

    // The bearer token itself must not echo back in the response body.
    expect(bodyStr).not.toContain(token)
  })

  // -------------------------------------------------------------------------
  // Scenario 3: GET /internal/platform/changes is read-only
  //
  // Calling the endpoint MUST NOT create or alter any platform_outbox_events row.
  // -------------------------------------------------------------------------
  it('GET /internal/platform/changes does NOT mutate any outbox rows (read-only invariant)', async () => {
    // Seed one row so the endpoint has something to return.
    await prisma.platformOutboxEvent.create({
      data: {
        eventType: 'TENANT_STATUS_CHANGED',
        tenantId: 'tenant-readonly-check',
        payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
        occurredAt: new Date(),
      },
    })

    const countBefore = await prisma.platformOutboxEvent.count()

    const token = await mintServiceToken()
    await request(app.getHttpServer())
      .get('/api/internal/platform/changes?since=0')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    const countAfter = await prisma.platformOutboxEvent.count()
    expect(countAfter).toBe(countBefore)
  })
})

// ---------------------------------------------------------------------------
// T-19 — RED: threat-matrix — GET /internal/platform/tenants
//
// Spec: tenant-registry — threat-matrix applicable rows; A10/A13
//
// Scenarios:
//   1. Correct secret but wrong iss/aud → 401 (cross-service token forgery)
//   2. Operator cookie (InmoView user session) sent with NO Authorization
//      header → 401 (token confusion — user↔service; PlatformControlGuard
//      never reads cookies, so an operator's own session cookie must not
//      grant access to the internal service-token-guarded route)
// ---------------------------------------------------------------------------
describe('Threat matrix — GET /internal/platform/tenants (T-19)', () => {
  let app: INestApplication
  let prisma: import('@prisma/client').PrismaClient

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.PLATFORM_CONTROL_SECRET = PLATFORM_CONTROL_SECRET

    const { createApiApp } = await import('../../bootstrap/create-app.js')
    app = await createApiApp()
    await app.init()

    const { PrismaService } = await import('../../database/prisma.service.js')
    prisma = app.get(PrismaService)
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    await prisma.tenantMembership.deleteMany()
    await prisma.tenant.deleteMany()
  })

  it('correct secret, wrong iss/aud → 401 (cross-service token forgery)', async () => {
    // Signed with the CORRECT PLATFORM_CONTROL_SECRET but claiming a forged
    // issuer/audience — verifyServiceToken must still reject it.
    const forgedToken = await serviceSigner.signAsync(
      { iss: 'attacker-service', aud: 'not-inmoview-control', sub: 'system-ingest', jti: `jti-${Date.now()}` },
      { expiresIn: '120s' },
    )

    await request(app.getHttpServer())
      .get('/api/internal/platform/tenants')
      .set('Authorization', `Bearer ${forgedToken}`)
      .expect(401)
  })

  it('operator cookie (viewpro_access_token) with no Authorization header → 401 (token confusion — user↔service)', async () => {
    const userToken = await mintUserToken()

    const res = await request(app.getHttpServer())
      .get('/api/internal/platform/tenants')
      .set('Cookie', `viewpro_access_token=${userToken}`)
      // No Authorization header — PlatformControlGuard only reads the
      // Authorization Bearer header, never cookies.

    expect(res.status).toBe(401)
  })
})
