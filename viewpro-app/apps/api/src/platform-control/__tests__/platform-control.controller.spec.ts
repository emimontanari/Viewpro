import type { INestApplication } from '@nestjs/common'
import { AnalyticsActorType, AnalyticsEventName, TenantStatus } from '@prisma/client'
import { JwtService } from '@nestjs/jwt'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// Integration spec: PlatformControlController (inbound)
// Tests run against the full NestJS app + test DB.
//
// Scenarios (spec: platform-control-lane-inbound):
//   - Valid status command → 200, tenant SUSPENDED
//   - Tenant not found → 404, NO idempotency row committed (retry allowed)
//   - Invalid targetStatus → 400, NO idempotency row committed (retry allowed)
//   - Valid limits command → 200, limits updated
//   - Duplicate idempotencyKey → 200 replay, tenant NOT mutated again, no second analytics event
//   - Different key → applies normally
//   - AnalyticsEvent has actorOperatorId=op-1, actorType=PLATFORM_OPERATOR, actorUserId=null
//   - actorUserId null for control-lane events
//   - ATOMICITY: single platform_command_log row per successful command (no ::result second row)
//   - ATOMICITY: failed mutation rolls back log row (no orphan idempotency key)
// ---------------------------------------------------------------------------

const PLATFORM_CONTROL_SECRET = 'test-platform-control-secret-min16'
const OPERATOR_ID = 'op-1'

process.env.PLATFORM_CONTROL_SECRET = PLATFORM_CONTROL_SECRET

const serviceSigner = new JwtService({ secret: PLATFORM_CONTROL_SECRET })

async function mintServiceToken(operatorId = OPERATOR_ID): Promise<string> {
  return serviceSigner.signAsync(
    { iss: 'viewpro-api', aud: 'inmoview-control', sub: operatorId, jti: `jti-${Date.now()}` },
    { expiresIn: '120s' },
  )
}

describe('PlatformControlController (integration)', () => {
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

  beforeEach(async () => {
    // Full cleanup matching admin e2e teardown order (FK-safe)
    await prisma.analyticsEvent.deleteMany()
    await prisma.platformCommandLog.deleteMany()
    await prisma.documentVersion.deleteMany()
    await prisma.document.deleteMany()
    await prisma.documentRequest.deleteMany()
    await prisma.propertyAssetOwner.deleteMany()
    await prisma.movement.deleteMany()
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

  async function seedTenant(slug: string) {
    return prisma.tenant.create({ data: { name: `Test ${slug}`, slug } })
  }

  // -------------------------------------------------------------------------
  // Status endpoint
  // -------------------------------------------------------------------------

  it('valid status command → 200, tenant SUSPENDED', async () => {
    const tenant = await seedTenant(`tenant-status-${Date.now()}`)
    const token = await mintServiceToken()

    const response = await request(app.getHttpServer())
      .post(`/api/internal/platform/tenants/${tenant.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'SUSPENDED', idempotencyKey: 'key-status-1' })
      .expect(200)

    expect(response.body.status).toBe('SUSPENDED')

    const updated = await prisma.tenant.findUnique({ where: { id: tenant.id } })
    expect(updated?.status).toBe(TenantStatus.SUSPENDED)
  })

  it('tenant not found → 404', async () => {
    const token = await mintServiceToken()

    await request(app.getHttpServer())
      .post('/api/internal/platform/tenants/non-existent-id/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'SUSPENDED', idempotencyKey: 'key-404-1' })
      .expect(404)
  })

  it('invalid targetStatus → 400', async () => {
    const tenant = await seedTenant(`tenant-badstatus-${Date.now()}`)
    const token = await mintServiceToken()

    await request(app.getHttpServer())
      .post(`/api/internal/platform/tenants/${tenant.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'INVALID_STATUS', idempotencyKey: 'key-bad-1' })
      .expect(400)
  })

  // -------------------------------------------------------------------------
  // Limits endpoint
  // -------------------------------------------------------------------------

  it('valid limits command → 200, limits updated', async () => {
    const tenant = await seedTenant(`tenant-limits-${Date.now()}`)
    const token = await mintServiceToken()

    const response = await request(app.getHttpServer())
      .post(`/api/internal/platform/tenants/${tenant.id}/limits`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        limits: { maxUsers: 25, maxActivePropertyEngagements: 10, maxDocumentsStorageMb: 500 },
        idempotencyKey: 'key-limits-1',
      })
      .expect(200)

    expect(response.body.limits).toMatchObject({ maxUsers: 25, maxActivePropertyEngagements: 10, maxDocumentsStorageMb: 500 })
  })

  // -------------------------------------------------------------------------
  // Idempotency
  // -------------------------------------------------------------------------

  it('duplicate idempotencyKey → 200 replay, tenant NOT mutated again', async () => {
    const tenant = await seedTenant(`tenant-idem-${Date.now()}`)
    const token = await mintServiceToken()
    const key = `idem-key-${Date.now()}`

    // First call: mutates tenant
    await request(app.getHttpServer())
      .post(`/api/internal/platform/tenants/${tenant.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'SUSPENDED', idempotencyKey: key })
      .expect(200)

    // Restore tenant status in DB to verify second call doesn't re-apply
    await prisma.tenant.update({ where: { id: tenant.id }, data: { status: TenantStatus.ACTIVE } })

    const eventsAfterFirst = await prisma.analyticsEvent.count({ where: { tenantId: tenant.id } })

    // Second call with same key: should return stored result, NOT mutate
    const replayResponse = await request(app.getHttpServer())
      .post(`/api/internal/platform/tenants/${tenant.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'SUSPENDED', idempotencyKey: key })
      .expect(200)

    // Tenant should still be ACTIVE (restored above, not re-mutated)
    const tenantAfterReplay = await prisma.tenant.findUnique({ where: { id: tenant.id } })
    expect(tenantAfterReplay?.status).toBe(TenantStatus.ACTIVE)

    // No new analytics event
    const eventsAfterReplay = await prisma.analyticsEvent.count({ where: { tenantId: tenant.id } })
    expect(eventsAfterReplay).toBe(eventsAfterFirst)

    // Response is the stored result
    expect(replayResponse.body).toMatchObject({ tenantId: tenant.id })
  })

  it('different idempotencyKey applies normally (second mutation occurs)', async () => {
    const tenant = await seedTenant(`tenant-diff-key-${Date.now()}`)
    const token = await mintServiceToken()

    await request(app.getHttpServer())
      .post(`/api/internal/platform/tenants/${tenant.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'SUSPENDED', idempotencyKey: `key-a-${Date.now()}` })
      .expect(200)

    await request(app.getHttpServer())
      .post(`/api/internal/platform/tenants/${tenant.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'ACTIVE', idempotencyKey: `key-b-${Date.now()}` })
      .expect(200)

    const tenant2 = await prisma.tenant.findUnique({ where: { id: tenant.id } })
    expect(tenant2?.status).toBe(TenantStatus.ACTIVE)
  })

  // -------------------------------------------------------------------------
  // Operator audit attribution
  // -------------------------------------------------------------------------

  it('AnalyticsEvent has actorOperatorId=op-1, actorType=PLATFORM_OPERATOR, actorUserId=null', async () => {
    const tenant = await seedTenant(`tenant-audit-${Date.now()}`)
    const token = await mintServiceToken('op-1')

    await request(app.getHttpServer())
      .post(`/api/internal/platform/tenants/${tenant.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'SUSPENDED', idempotencyKey: `key-audit-${Date.now()}` })
      .expect(200)

    const events = await prisma.analyticsEvent.findMany({ where: { tenantId: tenant.id } })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      actorOperatorId: 'op-1',
      actorType: AnalyticsActorType.PLATFORM_OPERATOR,
      actorUserId: null,
    })
  })

  it('actorUserId remains null for control-lane events', async () => {
    const tenant = await seedTenant(`tenant-null-user-${Date.now()}`)
    const token = await mintServiceToken()

    await request(app.getHttpServer())
      .post(`/api/internal/platform/tenants/${tenant.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'SUSPENDED', idempotencyKey: `key-null-user-${Date.now()}` })
      .expect(200)

    const events = await prisma.analyticsEvent.findMany({ where: { tenantId: tenant.id } })
    expect(events[0]?.actorUserId).toBeNull()
  })

  // -------------------------------------------------------------------------
  // Atomicity: single-transaction idempotency (new model)
  // -------------------------------------------------------------------------

  it('ATOMICITY — successful command creates exactly ONE platform_command_log row (no ::result second key)', async () => {
    const tenant = await seedTenant(`tenant-one-row-${Date.now()}`)
    const token = await mintServiceToken()
    const key = `atomic-one-row-${Date.now()}`

    await request(app.getHttpServer())
      .post(`/api/internal/platform/tenants/${tenant.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'SUSPENDED', idempotencyKey: key })
      .expect(200)

    // Must be exactly ONE row — no legacy ::result second row
    const rows = await prisma.platformCommandLog.findMany({ where: { idempotencyKey: { startsWith: key } } })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.idempotencyKey).toBe(key)
  })

  it('ATOMICITY — tenant not found → 404, NO platform_command_log row committed (retry is possible)', async () => {
    const token = await mintServiceToken()
    const key = `atomic-404-${Date.now()}`

    await request(app.getHttpServer())
      .post('/api/internal/platform/tenants/non-existent-id/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'SUSPENDED', idempotencyKey: key })
      .expect(404)

    // No log row must exist — failure rolled back the whole transaction
    const row = await prisma.platformCommandLog.findUnique({ where: { idempotencyKey: key } })
    expect(row).toBeNull()
  })

  it('ATOMICITY — unsupported targetStatus → 400, NO platform_command_log row committed (retry is possible)', async () => {
    const tenant = await seedTenant(`tenant-400-${Date.now()}`)
    const token = await mintServiceToken()
    const key = `atomic-400-${Date.now()}`

    await request(app.getHttpServer())
      .post(`/api/internal/platform/tenants/${tenant.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'INVALID_STATUS', idempotencyKey: key })
      .expect(400)

    const row = await prisma.platformCommandLog.findUnique({ where: { idempotencyKey: key } })
    expect(row).toBeNull()
  })

  it('ATOMICITY — replay returns stored result with 200, does NOT create second analytics event', async () => {
    const tenant = await seedTenant(`tenant-replay-atomic-${Date.now()}`)
    const token = await mintServiceToken()
    const key = `atomic-replay-${Date.now()}`

    // First call
    const firstResponse = await request(app.getHttpServer())
      .post(`/api/internal/platform/tenants/${tenant.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'SUSPENDED', idempotencyKey: key })
      .expect(200)

    const eventsAfterFirst = await prisma.analyticsEvent.count({ where: { tenantId: tenant.id } })
    expect(eventsAfterFirst).toBe(1)

    // Replay with same key
    const replayResponse = await request(app.getHttpServer())
      .post(`/api/internal/platform/tenants/${tenant.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'SUSPENDED', idempotencyKey: key })
      .expect(200)

    // Same result returned
    expect(replayResponse.body).toMatchObject(firstResponse.body)

    // No second analytics event
    const eventsAfterReplay = await prisma.analyticsEvent.count({ where: { tenantId: tenant.id } })
    expect(eventsAfterReplay).toBe(eventsAfterFirst)

    // Still only ONE log row
    const logRows = await prisma.platformCommandLog.findMany({ where: { idempotencyKey: key } })
    expect(logRows).toHaveLength(1)
  })

  it('ATOMICITY — stored result in log row contains real result (not sentinel placeholder)', async () => {
    const tenant = await seedTenant(`tenant-real-result-${Date.now()}`)
    const token = await mintServiceToken()
    const key = `atomic-real-result-${Date.now()}`

    await request(app.getHttpServer())
      .post(`/api/internal/platform/tenants/${tenant.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'SUSPENDED', idempotencyKey: key })
      .expect(200)

    const logRow = await prisma.platformCommandLog.findUnique({ where: { idempotencyKey: key } })
    expect(logRow).not.toBeNull()
    // The stored result must be the real command result, not a sentinel like { reserved: true }
    const stored = logRow!.result as Record<string, unknown>
    expect(stored).not.toMatchObject({ reserved: true })
    expect(stored.tenantId).toBe(tenant.id)
    expect(stored.status).toBe('SUSPENDED')
  })
})
