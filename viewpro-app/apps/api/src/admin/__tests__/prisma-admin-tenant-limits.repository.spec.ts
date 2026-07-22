import { describe, it, expect, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import type { CommandActor } from '../admin-actor'
import { PrismaAdminTenantLimitsRepository } from '../prisma-admin-tenant-limits.repository'

// ---------------------------------------------------------------------------
// T-10 — RED: limits repo emits its first-ever AUDIT_LOGGED event; rollback
// ⇒ no event (regression guard c)
//
// Spec: platform-audit-log — Limits Change Audit Event — Transactional Emit
//   (both scenarios)
// ---------------------------------------------------------------------------

type TenantLimitsRow = {
  id: string
  maxUsers: number | null
  maxActivePropertyEngagements: number | null
  maxDocumentsStorageMb: number | null
  updatedAt: Date
}

function makeMockTx(tenantRow: TenantLimitsRow | undefined, overrides?: { update?: ReturnType<typeof vi.fn> }) {
  const queryRaw = vi.fn().mockResolvedValue(tenantRow ? [tenantRow] : [])
  const tenantUpdate =
    overrides?.update ??
    vi.fn().mockImplementation(({ data }: { data: Partial<TenantLimitsRow> }) =>
      Promise.resolve({ ...tenantRow, ...data }),
    )
  const analyticsEventCreate = vi.fn().mockResolvedValue({ id: 'evt-1' })

  return {
    $queryRaw: queryRaw,
    tenant: { update: tenantUpdate },
    analyticsEvent: { create: analyticsEventCreate },
  } as unknown as Prisma.TransactionClient
}

function makeOutboxWriterStub() {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

const NOW = new Date('2026-02-01T00:00:00Z')

describe('PrismaAdminTenantLimitsRepository — first-ever AUDIT_LOGGED emit (T-10)', () => {
  // platform-manual-plans (Slice 4, Part 1): the 'updated' branch now ALSO
  // emits TENANT_LIMITS_CHANGED in the same tx (see the dedicated describe
  // block below) — this test asserts the AUDIT_LOGGED emit specifically,
  // filtered by eventType rather than assuming it is the only/first call.
  it('updated branch: emits AUDIT_LOGGED with action=TENANT_LIMITS_UPDATED (among its emits)', async () => {
    const tenantRow: TenantLimitsRow = {
      id: 'tenant-1',
      maxUsers: 10,
      maxActivePropertyEngagements: 5,
      maxDocumentsStorageMb: 100,
      updatedAt: new Date(),
    }
    const tx = makeMockTx(tenantRow)
    const outboxWriter = makeOutboxWriterStub()
    const repo = new PrismaAdminTenantLimitsRepository({} as never, outboxWriter as never)
    const actor: CommandActor = { type: 'operator', operatorId: 'op-1' }

    await repo.updateTenantLimits(
      {
        tenantId: 'tenant-1',
        limits: { maxUsers: 25, maxActivePropertyEngagements: 5, maxDocumentsStorageMb: 100 },
        actor,
        now: NOW,
      },
      tx,
    )

    const auditCall = outboxWriter.emit.mock.calls.find(
      ([, event]) => event.eventType === 'AUDIT_LOGGED',
    )!
    const [callTx, callEvent] = auditCall
    expect(callTx).toBe(tx)
    expect(callEvent).toEqual({
      eventType: 'AUDIT_LOGGED',
      tenantId: 'tenant-1',
      payload: {
        action: 'TENANT_LIMITS_UPDATED',
        previousValue: { maxUsers: 10, maxActivePropertyEngagements: 5, maxDocumentsStorageMb: 100 },
        newValue: { maxUsers: 25, maxActivePropertyEngagements: 5, maxDocumentsStorageMb: 100 },
        actor: { id: 'op-1', type: 'operator', label: 'op-1' },
      },
      occurredAt: NOW,
    })
  })

  it('unchanged branch: outboxWriter.emit NOT called (regression guard c, mirrors D4)', async () => {
    const tenantRow: TenantLimitsRow = {
      id: 'tenant-1',
      maxUsers: 10,
      maxActivePropertyEngagements: 5,
      maxDocumentsStorageMb: 100,
      updatedAt: new Date(),
    }
    const tx = makeMockTx(tenantRow)
    const outboxWriter = makeOutboxWriterStub()
    const repo = new PrismaAdminTenantLimitsRepository({} as never, outboxWriter as never)
    const actor: CommandActor = { type: 'user', userId: 'u-1' }

    const result = await repo.updateTenantLimits(
      {
        tenantId: 'tenant-1',
        limits: { maxUsers: 10, maxActivePropertyEngagements: 5, maxDocumentsStorageMb: 100 },
        actor,
        now: NOW,
      },
      tx,
    )

    expect(result.status).toBe('unchanged')
    expect(outboxWriter.emit).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // platform-manual-plans (Slice 4, Part 1) — RED: limits repo ALSO emits
  // TENANT_LIMITS_CHANGED (staleness fix) in the SAME tx as AUDIT_LOGGED.
  //
  // Spec: TENANT_LIMITS_CHANGED outbox event / Atomic emission on limits change
  // -------------------------------------------------------------------------
  it('updated branch: ALSO emits TENANT_LIMITS_CHANGED with the new limits, alongside AUDIT_LOGGED', async () => {
    const tenantRow: TenantLimitsRow = {
      id: 'tenant-1',
      maxUsers: 10,
      maxActivePropertyEngagements: 5,
      maxDocumentsStorageMb: 100,
      updatedAt: new Date(),
    }
    const tx = makeMockTx(tenantRow)
    const outboxWriter = makeOutboxWriterStub()
    const repo = new PrismaAdminTenantLimitsRepository({} as never, outboxWriter as never)
    const actor: CommandActor = { type: 'operator', operatorId: 'op-1' }

    await repo.updateTenantLimits(
      {
        tenantId: 'tenant-1',
        limits: { maxUsers: 25, maxActivePropertyEngagements: 5, maxDocumentsStorageMb: 100 },
        actor,
        now: NOW,
      },
      tx,
    )

    expect(outboxWriter.emit).toHaveBeenCalledTimes(2)

    const eventTypes = outboxWriter.emit.mock.calls.map(([, event]) => event.eventType)
    expect(eventTypes).toContain('AUDIT_LOGGED')
    expect(eventTypes).toContain('TENANT_LIMITS_CHANGED')

    const limitsCall = outboxWriter.emit.mock.calls.find(
      ([, event]) => event.eventType === 'TENANT_LIMITS_CHANGED',
    )!
    const [limitsTx, limitsEvent] = limitsCall
    expect(limitsTx).toBe(tx)
    expect(limitsEvent).toEqual({
      eventType: 'TENANT_LIMITS_CHANGED',
      tenantId: 'tenant-1',
      payload: {
        limits: { maxUsers: 25, maxActivePropertyEngagements: 5, maxDocumentsStorageMb: 100 },
      },
      occurredAt: NOW,
    })
  })

  it('unchanged branch: TENANT_LIMITS_CHANGED NOT emitted (only the pre-existing no-emit behavior)', async () => {
    const tenantRow: TenantLimitsRow = {
      id: 'tenant-1',
      maxUsers: 10,
      maxActivePropertyEngagements: 5,
      maxDocumentsStorageMb: 100,
      updatedAt: new Date(),
    }
    const tx = makeMockTx(tenantRow)
    const outboxWriter = makeOutboxWriterStub()
    const repo = new PrismaAdminTenantLimitsRepository({} as never, outboxWriter as never)
    const actor: CommandActor = { type: 'user', userId: 'u-1' }

    await repo.updateTenantLimits(
      {
        tenantId: 'tenant-1',
        limits: { maxUsers: 10, maxActivePropertyEngagements: 5, maxDocumentsStorageMb: 100 },
        actor,
        now: NOW,
      },
      tx,
    )

    const eventTypes = outboxWriter.emit.mock.calls.map(([, event]) => event.eventType)
    expect(eventTypes).not.toContain('TENANT_LIMITS_CHANGED')
  })

  it('notFound branch: outboxWriter.emit NOT called (regression guard c)', async () => {
    const tx = makeMockTx(undefined)
    const outboxWriter = makeOutboxWriterStub()
    const repo = new PrismaAdminTenantLimitsRepository({} as never, outboxWriter as never)
    const actor: CommandActor = { type: 'user', userId: 'u-1' }

    const result = await repo.updateTenantLimits(
      {
        tenantId: 'missing-tenant',
        limits: { maxUsers: 10, maxActivePropertyEngagements: 5, maxDocumentsStorageMb: 100 },
        actor,
        now: NOW,
      },
      tx,
    )

    expect(result.status).toBe('notFound')
    expect(outboxWriter.emit).not.toHaveBeenCalled()
  })
})
