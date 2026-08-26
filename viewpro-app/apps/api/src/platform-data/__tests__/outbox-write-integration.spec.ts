import type { INestApplication } from '@nestjs/common'
import { TenantStatus } from '@prisma/client'
import { JwtService } from '@nestjs/jwt'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

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

    // platform-audit-log (T-09): the status change now ALSO emits a 2nd
    // AUDIT_LOGGED row in the same tx (see the [T-08] tests below) — filter to
    // TENANT_STATUS_CHANGED to keep this regression test's assertion precise.
    const rows = await prisma.platformOutboxEvent.findMany({
      where: { tenantId: tenant.id, eventType: 'TENANT_STATUS_CHANGED' },
    })

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
  // T-06 — RED: TENANT_STATUS_CHANGED payload now carries name and slug (A3)
  //
  // Spec: platform-data-lane delta — Modified Transactional Outbox Write
  //   - After updateTenantStatus → payload contains name and slug matching the tenant's DB values
  //   - payload.previousStatus and payload.newStatus are still present (regression)
  // -------------------------------------------------------------------------
  it('[T-06] TENANT_STATUS_CHANGED outbox payload includes name and slug (A3)', async () => {
    const uniqueSuffix = Date.now()
    const tenant = await prisma.tenant.create({
      data: { name: `Acme Corp ${uniqueSuffix}`, slug: `acme-corp-${uniqueSuffix}`, status: 'TRIAL' },
    })
    const token = await mintServiceToken()

    await request(app.getHttpServer())
      .post(`/api/internal/platform/tenants/${tenant.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'ACTIVE', idempotencyKey: `t06-name-slug-${uniqueSuffix}` })
      .expect(200)

    // platform-audit-log (T-09): filter to TENANT_STATUS_CHANGED — the status
    // change now also emits a 2nd AUDIT_LOGGED row in the same tx.
    const rows = await prisma.platformOutboxEvent.findMany({
      where: { tenantId: tenant.id, eventType: 'TENANT_STATUS_CHANGED' },
    })
    expect(rows).toHaveLength(1)

    const payload = rows[0]!.payload as Record<string, unknown>
    // Regression: previousStatus and newStatus still present
    expect(payload.previousStatus).toBe('TRIAL')
    expect(payload.newStatus).toBe('ACTIVE')
    // A3 enrichment: name and slug now included
    expect(payload.name).toBe(`Acme Corp ${uniqueSuffix}`)
    expect(payload.slug).toBe(`acme-corp-${uniqueSuffix}`)
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
  // T-08 — RED: status change also emits AUDIT_LOGGED as a 2nd outbox row,
  // in the SAME transaction as TENANT_STATUS_CHANGED (regression guard b).
  //
  // Spec: platform-audit-log — Status Change Audit Event — Transactional Emit
  // -------------------------------------------------------------------------
  it('[T-08] updated branch: exactly one TENANT_STATUS_CHANGED AND exactly one AUDIT_LOGGED outbox row', async () => {
    const tenant = await seedTenant(`outbox-audit-status-${Date.now()}`, TenantStatus.TRIAL)
    const token = await mintServiceToken()

    await request(app.getHttpServer())
      .post(`/api/internal/platform/tenants/${tenant.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'ACTIVE', idempotencyKey: `outbox-audit-status-${Date.now()}` })
      .expect(200)

    const rows = await prisma.platformOutboxEvent.findMany({ where: { tenantId: tenant.id } })
    expect(rows).toHaveLength(2)

    const statusRow = rows.find((r) => r.eventType === 'TENANT_STATUS_CHANGED')
    const auditRow = rows.find((r) => r.eventType === 'AUDIT_LOGGED')
    expect(statusRow).toBeDefined()
    expect(auditRow).toBeDefined()

    const auditPayload = auditRow!.payload as Record<string, unknown>
    expect(auditPayload.action).toBe('TENANT_STATUS_CHANGED')
    expect(auditPayload.previousValue).toEqual({ status: 'TRIAL' })
    expect(auditPayload.newValue).toEqual({ status: 'ACTIVE' })
    expect(auditPayload.actor).toBeDefined()
  })

  // -------------------------------------------------------------------------
  // T-08 — RED: rolled-back status transaction leaves no AUDIT_LOGGED row
  // (in addition to the pre-existing no-TENANT_STATUS_CHANGED-row assertion)
  // -------------------------------------------------------------------------
  it('[T-08] invalid request (400) leaves zero AUDIT_LOGGED rows (rolled-back tx)', async () => {
    const tenant = await seedTenant(`outbox-audit-rollback-${Date.now()}`)
    const token = await mintServiceToken()

    await request(app.getHttpServer())
      .post(`/api/internal/platform/tenants/${tenant.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetStatus: 'NOT_VALID_STATUS', idempotencyKey: `outbox-audit-rollback-${Date.now()}` })
      .expect(400)

    const auditRows = await prisma.platformOutboxEvent.findMany({
      where: { tenantId: tenant.id, eventType: 'AUDIT_LOGGED' },
    })
    expect(auditRows).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // T-10 — RED: limits change emits its first-ever AUDIT_LOGGED outbox row,
  // in the SAME transaction as the limits mutation.
  //
  // Spec: platform-audit-log — Limits Change Audit Event — Transactional Emit
  // -------------------------------------------------------------------------
  it('[T-10] updated branch: exactly one AUDIT_LOGGED outbox row (limits first-ever emit)', async () => {
    const tenant = await prisma.tenant.create({
      data: {
        name: `Limits Corp ${Date.now()}`,
        slug: `limits-corp-${Date.now()}`,
        status: 'ACTIVE',
        maxUsers: 10,
        maxActivePropertyEngagements: 5,
        maxDocumentsStorageMb: 100,
      },
    })
    const token = await mintServiceToken()

    await request(app.getHttpServer())
      .post(`/api/internal/platform/tenants/${tenant.id}/limits`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        limits: { maxUsers: 25, maxActivePropertyEngagements: 5, maxDocumentsStorageMb: 100 },
        idempotencyKey: `outbox-audit-limits-${Date.now()}`,
      })
      .expect(200)

    // platform-manual-plans (Slice 4, Part 1): the limits update now ALSO
    // emits a TENANT_LIMITS_CHANGED row in the same tx (staleness fix).
    const rows = await prisma.platformOutboxEvent.findMany({ where: { tenantId: tenant.id } })
    expect(rows).toHaveLength(2)

    const auditRow = rows.find((r) => r.eventType === 'AUDIT_LOGGED')
    const limitsChangedRow = rows.find((r) => r.eventType === 'TENANT_LIMITS_CHANGED')
    expect(auditRow).toBeDefined()
    expect(limitsChangedRow).toBeDefined()

    const payload = auditRow!.payload as Record<string, unknown>
    expect(payload.action).toBe('TENANT_LIMITS_UPDATED')
    expect(payload.previousValue).toEqual({
      maxUsers: 10,
      maxActivePropertyEngagements: 5,
      maxDocumentsStorageMb: 100,
    })
    expect(payload.newValue).toEqual({
      maxUsers: 25,
      maxActivePropertyEngagements: 5,
      maxDocumentsStorageMb: 100,
    })
    expect(payload.actor).toBeDefined()

    const limitsChangedPayload = limitsChangedRow!.payload as Record<string, unknown>
    expect(limitsChangedPayload.limits).toEqual({
      maxUsers: 25,
      maxActivePropertyEngagements: 5,
      maxDocumentsStorageMb: 100,
    })
  })

  // -------------------------------------------------------------------------
  // T-10 — RED: rolled-back limits transaction leaves zero AUDIT_LOGGED rows
  // (regression guard c)
  // -------------------------------------------------------------------------
  it('[T-10] invalid request (400) leaves zero AUDIT_LOGGED rows for limits (rolled-back tx)', async () => {
    const tenant = await prisma.tenant.create({
      data: {
        name: `Limits Rollback ${Date.now()}`,
        slug: `limits-rollback-${Date.now()}`,
        status: 'ACTIVE',
        maxUsers: 10,
        maxActivePropertyEngagements: 5,
        maxDocumentsStorageMb: 100,
      },
    })
    const token = await mintServiceToken()

    await request(app.getHttpServer())
      .post(`/api/internal/platform/tenants/${tenant.id}/limits`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        limits: { maxUsers: -5, maxActivePropertyEngagements: 5, maxDocumentsStorageMb: 100 },
        idempotencyKey: `outbox-audit-limits-rollback-${Date.now()}`,
      })
      .expect(400)

    const rows = await prisma.platformOutboxEvent.findMany({
      where: { tenantId: tenant.id, eventType: 'AUDIT_LOGGED' },
    })
    expect(rows).toHaveLength(0)

    // platform-manual-plans (Slice 4, Part 1): rollback must also leave zero
    // TENANT_LIMITS_CHANGED rows (atomic emission — both events or neither).
    const limitsChangedRows = await prisma.platformOutboxEvent.findMany({
      where: { tenantId: tenant.id, eventType: 'TENANT_LIMITS_CHANGED' },
    })
    expect(limitsChangedRows).toHaveLength(0)
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
    // platform-audit-log (T-09): TENANT_STATUS_CHANGED + its 2nd AUDIT_LOGGED emit.
    expect(outboxRows).toHaveLength(2)
    expect(outboxRows.map((r) => r.eventType).sort()).toEqual(['AUDIT_LOGGED', 'TENANT_STATUS_CHANGED'])
  })
})
