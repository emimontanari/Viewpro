import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { PrismaService } from '../../database/prisma.service'
import { IngestService } from '../ingest.service'
import { MirrorRepository } from '../mirror.repository'
import { CursorRepository } from '../cursor.repository'
import { PlatformTenantRepository } from '../platform-tenant.repository'
import { AuditLogRepository } from '../audit-log.repository'
import { MetricsService } from '../metrics.service'
import type { PlatformOutboxEvent } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }

/**
 * T-20 — RED: integration regression suite — mirror uncorrupted, metrics
 * uncorrupted, tx atomicity end-to-end (regression guards a/b/c/d, full
 * pipeline).
 *
 * Spec: platform-data-lane delta — Tenant status metrics are not corrupted
 *   by AUDIT_LOGGED events; platform-audit-log — all transactional-emit and
 *   idempotency scenarios (full-pipeline confirmation).
 *
 * Regression guard (c) — "limits emit is inside the tx, rollback ⇒ no
 * event" — is proven by WU-1's existing `apps/api` outbox-write-integration
 * suite (T-10), which is untouched by WU-2 and re-verified via
 * `pnpm --filter @viewpro/api test` (see T-21 exit criteria). It is not
 * re-tested here because it lives entirely on the InmoView (apps/api) side,
 * out of WU-2 scope.
 */
function makeStatusEvent(overrides: Partial<PlatformOutboxEvent> = {}): PlatformOutboxEvent {
  return {
    id: 'evt-pipeline-status',
    seqNo: 1,
    eventType: 'TENANT_STATUS_CHANGED',
    tenantId: 't-pipeline',
    payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
    occurredAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeAuditEvent(overrides: Partial<PlatformOutboxEvent> = {}): PlatformOutboxEvent {
  return {
    id: 'evt-pipeline-audit',
    seqNo: 2,
    eventType: 'AUDIT_LOGGED',
    tenantId: 't-pipeline',
    payload: {
      action: 'TENANT_LIMITS_UPDATED',
      previousValue: { maxUsers: 5 },
      newValue: { maxUsers: 10 },
      actor: { id: 'op-1', type: 'operator', label: 'op-1' },
    },
    occurredAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('Audit pipeline — full-pipeline regression (T-20/T-21, guards a/b/d)', () => {
  let moduleRef: TestingModule
  let ingestService: IngestService
  let metricsService: MetricsService
  let prisma: PrismaService

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule],
      providers: [
        IngestService,
        MirrorRepository,
        CursorRepository,
        PlatformTenantRepository,
        AuditLogRepository,
        MetricsService,
      ],
    }).compile()

    ingestService = moduleRef.get(IngestService)
    metricsService = moduleRef.get(MetricsService)
    prisma = moduleRef.get(PrismaService)
  })

  afterAll(async () => {
    await moduleRef.close()
  })

  beforeEach(async () => {
    await prisma.platformAuditLog.deleteMany()
    await prisma.platformTenant.deleteMany()
    await prisma.platformMirrorEvent.deleteMany()
    await prisma.platformIngestCursor.upsert({
      where: { id: 1 },
      update: { seqNo: 0 },
      create: { id: 1, seqNo: 0 },
    })
  })

  // Regression guard (a): a subsequent AUDIT_LOGGED event for a tenant with
  // an existing ACTIVE mirror row must NOT corrupt MetricsService's
  // latest-event-wins status breakdown — because the AUDIT_LOGGED event
  // never enters the mirror, it cannot become the "latest" row.
  it('[guard a] AUDIT_LOGGED after a mirrored status change → metrics.byStatus still counts the tenant under its real status; mirror row count for that tenant unchanged', async () => {
    // Seed a mirror row for t-pipeline via the real ingest path (status change).
    await ingestService.ingestBatch([makeStatusEvent({ id: 'evt-guard-a-status', seqNo: 1 })])

    const mirrorCountBefore = await prisma.platformMirrorEvent.count({
      where: { tenantId: 't-pipeline' },
    })
    expect(mirrorCountBefore).toBe(1)

    // Now ingest a subsequent AUDIT_LOGGED event for the same tenant (e.g. a limits change).
    await ingestService.ingestBatch([makeAuditEvent({ id: 'evt-guard-a-audit', seqNo: 2 })])

    const mirrorCountAfter = await prisma.platformMirrorEvent.count({
      where: { tenantId: 't-pipeline' },
    })
    expect(mirrorCountAfter).toBe(1) // unchanged — AUDIT_LOGGED never entered the mirror

    const summary = await metricsService.getSummary()
    expect(summary.byStatus['ACTIVE']).toBeGreaterThanOrEqual(1)
    // No blank/undefined bucket introduced by the AUDIT_LOGGED event.
    expect(summary.byStatus['']).toBeUndefined()
  })

  // Regression guard (b): a mixed batch containing one TENANT_STATUS_CHANGED
  // and one AUDIT_LOGGED event → platform_tenants.latestStatus reflects the
  // status-change routing EXACTLY as before this change; platform_audit_log
  // gains exactly one row (for the AUDIT_LOGGED event only).
  it('[guard b] mixed batch (TENANT_STATUS_CHANGED + AUDIT_LOGGED) → platform_tenants unregressed; platform_audit_log gains exactly one row', async () => {
    await ingestService.ingestBatch([
      makeStatusEvent({ id: 'evt-guard-b-status', seqNo: 1 }),
      makeAuditEvent({ id: 'evt-guard-b-audit', seqNo: 2 }),
    ])

    const tenantRow = await prisma.platformTenant.findUnique({ where: { id: 't-pipeline' } })
    expect(tenantRow?.latestStatus).toBe('ACTIVE')

    const auditRows = await prisma.platformAuditLog.findMany({ where: { tenantId: 't-pipeline' } })
    expect(auditRows).toHaveLength(1)
  })

  // Regression guard (d): re-delivering the identical AUDIT_LOGGED event
  // (same sourceEventId) through ingestBatch TWICE → platform_audit_log
  // still contains exactly one row for that sourceEventId; no error.
  it('[guard d] re-delivering the same AUDIT_LOGGED event twice through ingestBatch → still exactly one platform_audit_log row, no error', async () => {
    const evt = makeAuditEvent({ id: 'evt-guard-d-replay', seqNo: 5 })

    await ingestService.ingestBatch([evt])
    await expect(ingestService.ingestBatch([evt])).resolves.toBeUndefined()

    const rows = await prisma.platformAuditLog.findMany({
      where: { sourceEventId: 'evt-guard-d-replay' },
    })
    expect(rows).toHaveLength(1)
  })
})
