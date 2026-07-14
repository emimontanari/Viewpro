import type { INestApplication } from '@nestjs/common'
import { TenantStatus } from '@prisma/client'
import { JwtService } from '@nestjs/jwt'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

// ---------------------------------------------------------------------------
// T-09 — RED: integration test — outbox write inside repo $transaction
//
// Spec: Transactional Outbox Write
//   - After a successful updateTenantStatus call: exactly one platform_outbox_events
//     row exists with eventType=TENANT_STATUS_CHANGED, correct tenantId, payload
//   - After a forced rollback: zero platform_outbox_events rows persist
//   - D4 invariant: no-op/unchanged branch emits NO outbox row
//
// Uses the full NestJS app + test DB via PATCH /admin/tenants/:id/status endpoint.
// ---------------------------------------------------------------------------

const PLATFORM_CONTROL_SECRET = process.env.PLATFORM_CONTROL_SECRET ?? 'test-platform-control-secret-min16'
const serviceSigner = new JwtService({ secret: PLATFORM_CONTROL_SECRET })

async function mintServiceToken(): Promise<string> {
  return serviceSigner.signAsync(
    { iss: 'viewpro-api', aud: 'inmoview-control', sub: 'op-test', jti: `jti-${Date.now()}` },
    { expiresIn: '120s' },
  )
}

describe('Outbox write integration — $transaction atomicity', () => {
  let app: INestApplication
  let prisma: import('@prisma/client').PrismaClient

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'

    const { createApiApp } = await import('../../bootstrap/create-app.js')
    app = await createApiApp()
    await app.init()

    const { PrismaService } = await import('../../database/prisma.service.js')
    prisma = app.get(PrismaService)
  })

  beforeEach(async () => {
    await prisma.platformOutboxEvent.deleteMany()
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

  async function seedTenant(slug: string, status: TenantStatus = TenantStatus.TRIAL) {
    return prisma.tenant.create({ data: { name: `Test ${slug}`, slug, status } })
  }

  // -------------------------------------------------------------------------
  // Scenario: Status change commits outbox row in same transaction
  // -------------------------------------------------------------------------
  it('updated branch: exactly one TENANT_STATUS_CHANGED outbox row with correct fields', async () => {
    const tenant = await seedTenant(`outbox-commit-${Date.now()}`, TenantStatus.TRIAL)
    const token = await mintServiceToken()

    await request(app.getHttpServer())
      .post(`/api/internal/platform/tenants/${tenant.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'ACTIVE', idempotencyKey: `outbox-commit-${Date.now()}` })
      .expect(200)

    const rows = await prisma.platformOutboxEvent.findMany({ where: { tenantId: tenant.id } })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      eventType: 'TENANT_STATUS_CHANGED',
      tenantId: tenant.id,
    })

    const payload = rows[0]!.payload as Record<string, string>
    expect(payload.previousStatus).toBe('TRIAL')
    expect(payload.newStatus).toBe('ACTIVE')
  })

  // -------------------------------------------------------------------------
  // Scenario: Rolled-back domain transaction leaves no outbox row (D3 atomicity)
  // We trigger a rollback by sending an invalid targetStatus after seeding so
  // the transaction aborts — no outbox row should be committed.
  // -------------------------------------------------------------------------
  it('invalid request (400) leaves zero outbox rows (rolled-back tx)', async () => {
    const tenant = await seedTenant(`outbox-rollback-${Date.now()}`)
    const token = await mintServiceToken()

    await request(app.getHttpServer())
      .post(`/api/internal/platform/tenants/${tenant.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'NOT_VALID_STATUS', idempotencyKey: `outbox-rollback-${Date.now()}` })
      .expect(400)

    const rows = await prisma.platformOutboxEvent.findMany({ where: { tenantId: tenant.id } })
    expect(rows).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // Scenario: D4 invariant — unchanged/no-op branch emits NO outbox row
  // -------------------------------------------------------------------------
  it('unchanged branch (same status): NO outbox row emitted (D4)', async () => {
    const tenant = await seedTenant(`outbox-unchanged-${Date.now()}`, TenantStatus.ACTIVE)
    const token = await mintServiceToken()

    // Send to the same status — triggers unchanged branch in repo
    await request(app.getHttpServer())
      .post(`/api/internal/platform/tenants/${tenant.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'ACTIVE', idempotencyKey: `outbox-unchanged-${Date.now()}` })
      .expect(200)

    const rows = await prisma.platformOutboxEvent.findMany({ where: { tenantId: tenant.id } })
    expect(rows).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // Scenario: outbox row commits atomically WITH the tenant update and analyticsEvent
  // -------------------------------------------------------------------------
  it('outbox row, tenant update, and analyticsEvent all committed in the same tx', async () => {
    const tenant = await seedTenant(`outbox-atomic-${Date.now()}`, TenantStatus.TRIAL)
    const token = await mintServiceToken()

    await request(app.getHttpServer())
      .post(`/api/internal/platform/tenants/${tenant.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'SUSPENDED', idempotencyKey: `outbox-atomic-${Date.now()}` })
      .expect(200)

    const [updatedTenant, analyticsEvents, outboxRows] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenant.id } }),
      prisma.analyticsEvent.findMany({ where: { tenantId: tenant.id } }),
      prisma.platformOutboxEvent.findMany({ where: { tenantId: tenant.id } }),
    ])

    expect(updatedTenant?.status).toBe(TenantStatus.SUSPENDED)
    expect(analyticsEvents).toHaveLength(1)
    expect(outboxRows).toHaveLength(1)
  })
})
