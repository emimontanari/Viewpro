/**
 * E2E boundary proof for the mandatory agency contact phone (#287, WU5).
 *
 * This slice adds NO production behaviour. WU2b (registration) and WU4
 * (settings parity) already implement the rule; this file proves it end to
 * end over real HTTP, at `NODE_ENV=test` (design.md ADR-5 — a production
 * boot is not reachable from a supertest e2e).
 *
 * Covers:
 *   - POST /api/auth/register-tenant: absent / '' / whitespace-only phone
 *     → 400 phone.required
 *   - POST /api/auth/register-tenant: unparseable phone → 400 phone.invalid
 *   - POST /api/auth/register-tenant: valid non-AR phone → 400
 *     phone.country_unsupported
 *   - POST /api/auth/register-tenant: valid AR phone → 201, persisted as
 *     canonical E.164, read back through the permission-gated GET
 *   - POST /api/auth/register-tenant: legacy national form → 201, persisted
 *     as the canonical E.164 form
 *   - PATCH /tenants/me/whatsapp-phone: null → 400 phone.required, under the
 *     endpoint's existing TENANT_MANAGE_SETTINGS authorization
 */

import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApiApp } from '../src/bootstrap/create-app'
import { PrismaService } from '../src/database/prisma.service'

describe('Register Tenant — mandatory AR contact phone (e2e, #287 WU5)', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.ACCESS_TOKEN_SECRET = 'test-access-token-secret'
    process.env.COOKIE_DOMAIN = 'localhost'
    process.env.COOKIE_SECURE = 'false'

    app = await createApiApp()
    await app.listen(0)
    prisma = app.get(PrismaService)
  })

  beforeEach(async () => {
    await prisma.movement.deleteMany()
    await prisma.tenantMovementOutcomeLabel.deleteMany()
    await prisma.propertyAgent.deleteMany()
    await prisma.propertyEngagement.deleteMany()
    await prisma.propertyAsset.deleteMany()
    await prisma.refreshToken.deleteMany()
    await prisma.tenantMembership.deleteMany()
    await prisma.tenant.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await app.close()
  })

  // ─── phone.required — absent, empty and whitespace-only all collapse ───────

  it.each([
    ['absent', undefined],
    ['empty string', ''],
    ['whitespace-only', '   '],
  ])('rejects a %s phone as 400 phone.required', async (_label, whatsappPhone) => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register-tenant')
      .send(buildRegisterBody({ whatsappPhone, email: `phone-required-${Date.now()}-${Math.random()}@example.com` }))
      .expect(400)

    expect(res.body).toMatchObject({ errorCode: 'phone.required' })
  })

  // ─── phone.invalid — a value was submitted but is not a usable AR number ───

  it('rejects an unparseable phone as 400 phone.invalid', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register-tenant')
      .send(buildRegisterBody({ whatsappPhone: '123', email: 'phone-invalid@example.com' }))
      .expect(400)

    expect(res.body).toMatchObject({ errorCode: 'phone.invalid' })
  })

  // ─── phone.country_unsupported — only reachable from an already-valid number

  it('rejects a valid non-Argentine phone as 400 phone.country_unsupported', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register-tenant')
      .send(buildRegisterBody({ whatsappPhone: '+56912345678', email: 'phone-unsupported@example.com' }))
      .expect(400)

    expect(res.body).toMatchObject({ errorCode: 'phone.country_unsupported' })
  })

  // ─── a non-string phone never reaches the parser ──────────────────────────

  it('rejects a non-string phone on the pipe, before the use case runs', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register-tenant')
      .send({ ...buildRegisterBody({ email: 'phone-nonstring@example.com' }), whatsappPhone: 123 })
      .expect(400)

    // The DTO declares `@IsString()`, so class-validator rejects a number
    // before the use case runs. `parseArContactPhone` does map a non-string to
    // `phone.required`, but that branch is unreachable over HTTP — it only
    // fires on a direct call. Pinning the real behaviour here rather than the
    // parser's contract keeps the two from being confused.
    expect(res.body.errorCode).toBeUndefined()
  })

  // ─── the AR affordance is presentation-only, never a submitted key ────────

  it('rejects an extra country key on the whitelist, before any phone logic', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register-tenant')
      .send({
        ...buildRegisterBody({ whatsappPhone: '3510000000', email: 'country-key@example.com' }),
        country: 'AR',
      })
      .expect(400)

    // `forbidNonWhitelisted: true` rejects the undeclared key before the use
    // case runs, so this 400 carries no `errorCode` at all. That is why the
    // Argentina affordance in the sign-up form is static presentation and
    // never a submitted field: sending one would replace a readable phone
    // message with a codeless rejection the client cannot explain.
    expect(res.body.errorCode).toBeUndefined()
  })

  // ─── ok:true — registration succeeds and the canonical E.164 is persisted ──

  it('accepts a valid Argentine phone: 201, and persists the canonical E.164', async () => {
    const registered = await registerTenantSession({
      email: 'phone-valid-ar@example.com',
      tenantName: 'Phone Valid AR Homes',
      whatsappPhone: '+5493510000000',
    })

    const row = await prisma.tenant.findUnique({
      where: { id: registered.tenantId },
      select: { whatsappPhone: true },
    })
    expect(row?.whatsappPhone).toBe('+5493510000000')

    const getRes = await registered.agent
      .get('/api/tenants/me/whatsapp-phone')
      .set('x-tenant-id', registered.tenantId)
      .expect(200)
    expect(getRes.body).toEqual({ whatsappPhone: '+5493510000000' })
  })

  it('accepts the legacy national form and persists the canonical E.164', async () => {
    const registered = await registerTenantSession({
      email: 'phone-legacy-national@example.com',
      tenantName: 'Phone Legacy National Homes',
      whatsappPhone: '3510000000',
    })

    const row = await prisma.tenant.findUnique({
      where: { id: registered.tenantId },
      select: { whatsappPhone: true },
    })
    expect(row?.whatsappPhone).toBe('+543510000000')

    const getRes = await registered.agent
      .get('/api/tenants/me/whatsapp-phone')
      .set('x-tenant-id', registered.tenantId)
      .expect(200)
    expect(getRes.body).toEqual({ whatsappPhone: '+543510000000' })
  })

  // ─── Settings parity — PATCH null is rejected under existing authorization ─

  it('PATCH /tenants/me/whatsapp-phone with null → 400 phone.required, under the existing authorization', async () => {
    const registered = await registerTenantSession({
      email: 'phone-settings-null@example.com',
      tenantName: 'Phone Settings Null Homes',
      whatsappPhone: '3510000000',
    })

    const res = await registered.agent
      .patch('/api/tenants/me/whatsapp-phone')
      .set('x-tenant-id', registered.tenantId)
      .send({ whatsappPhone: null })
      .expect(400)

    expect(res.body).toMatchObject({ errorCode: 'phone.required' })
  })

  // ─── Helper functions ────────────────────────────────────────────────────

  function buildRegisterBody(overrides: {
    whatsappPhone?: string
    email: string
  }): Record<string, unknown> {
    return {
      email: overrides.email,
      password: 'password123',
      firstName: 'Owner',
      tenantName: `Tenant ${Date.now()}-${Math.random()}`,
      ...(overrides.whatsappPhone !== undefined ? { whatsappPhone: overrides.whatsappPhone } : {}),
    }
  }

  async function registerTenantSession(options: {
    email: string
    tenantName: string
    whatsappPhone: string
  }) {
    const agent = request.agent(app.getHttpServer())
    const response = await agent
      .post('/api/auth/register-tenant')
      .send({
        whatsappPhone: options.whatsappPhone,
        email: options.email,
        password: 'password123',
        firstName: 'Owner',
        tenantName: options.tenantName,
      })
      .expect(201)

    return {
      agent,
      userId: response.body.user.id as string,
      tenantId: response.body.memberships[0].tenant.id as string,
    }
  }
})
