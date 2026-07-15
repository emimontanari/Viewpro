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
  it('updated branch: emits AUDIT_LOGGED once with action=TENANT_LIMITS_UPDATED', async () => {
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

    expect(outboxWriter.emit).toHaveBeenCalledOnce()

    const [callTx, callEvent] = outboxWriter.emit.mock.calls[0]!
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
