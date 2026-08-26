import type { INestApplication } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// Spec: Trust Path Isolation
// Scenarios:
//   - Service token rejected by AuthGuard: POST to a product route with only
//     a valid service JWT → 401 (AuthGuard expects user cookie, not Bearer token)
//   - User JWT rejected by PlatformControlGuard: POST to /internal/platform/...
//     with only a valid product user JWT (in Authorization header, not cookie) → 401
// ---------------------------------------------------------------------------

const PLATFORM_CONTROL_SECRET = 'test-platform-control-secret-min16'
const USER_ACCESS_SECRET = 'test-access-token-secret'

process.env.PLATFORM_CONTROL_SECRET = PLATFORM_CONTROL_SECRET

const serviceSigner = new JwtService({ secret: PLATFORM_CONTROL_SECRET })
const userSigner = new JwtService({ secret: USER_ACCESS_SECRET })

async function mintServiceToken(): Promise<string> {
  return serviceSigner.signAsync(
    { iss: 'viewpro-api', aud: 'inmoview-control', sub: 'op-1', jti: `jti-${Date.now()}` },
    { expiresIn: '120s' },
  )
}

async function mintUserToken(): Promise<string> {
  // A valid user access token (no aud=inmoview-control)
  return userSigner.signAsync({ sub: 'user-abc', email: 'user@example.com' }, { expiresIn: '900s' })
}

describe('Trust Path Isolation', () => {
  let app: INestApplication

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.PLATFORM_CONTROL_SECRET = PLATFORM_CONTROL_SECRET

    const { createApiApp } = await import('../../bootstrap/create-app.js')
    app = await createApiApp()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('service token is rejected by AuthGuard (product route requires user cookie, not Bearer)', async () => {
    // AuthGuard on /api/admin/* reads from cookies, not Authorization header.
    // A service token in the Authorization header (or no cookie) → 401.
    const serviceToken = await mintServiceToken()

    await request(app.getHttpServer())
      .get('/api/admin/access-check')
      .set('Authorization', `Bearer ${serviceToken}`)
      // No viewpro_access_token cookie — AuthGuard requires the cookie
      .expect(401)
  })

  it('user JWT is rejected by PlatformControlGuard (wrong secret and missing aud)', async () => {
    // A valid product user JWT is signed with USER_ACCESS_SECRET (not PLATFORM_CONTROL_SECRET)
    // and has no aud=inmoview-control. PlatformControlGuard must reject it.
    const userToken = await mintUserToken()

    const response = await request(app.getHttpServer())
      .post('/api/internal/platform/tenants/some-tenant-id/status')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ targetStatus: 'SUSPENDED', idempotencyKey: 'trust-isolation-key' })
      .expect(401)

    expect(response.body.message).toBeDefined()
  })

  it('user JWT in Bearer header does not set platformCaller (confirmed via 401 response)', async () => {
    const userToken = await mintUserToken()

    // If platformCaller were set incorrectly, the request would proceed past the guard.
    // We verify it does not by asserting 401 (the guard rejected it).
    await request(app.getHttpServer())
      .post('/api/internal/platform/tenants/any-id/status')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ targetStatus: 'ACTIVE', idempotencyKey: 'trust-check-key' })
      .expect(401)
  })
})
