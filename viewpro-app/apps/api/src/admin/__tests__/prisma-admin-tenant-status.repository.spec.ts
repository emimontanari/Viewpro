import { describe, it, expect, vi } from 'vitest'
import type { Prisma, TenantStatus } from '@prisma/client'
import type { CommandActor } from '../admin-actor'
import { PrismaAdminTenantStatusRepository } from '../prisma-admin-tenant-status.repository'

// ---------------------------------------------------------------------------
// T-08 — RED: status repo emits AUDIT_LOGGED as a 2nd emit in-tx; rollback ⇒
// neither event (regression guard b)
//
// Spec: platform-audit-log — Status Change Audit Event — Transactional Emit
//   (all 3 scenarios)
// ---------------------------------------------------------------------------

type TenantRow = {
  id: string
  status: TenantStatus
  updatedAt: Date
  name: string
  slug: string
}

function makeMockTx(tenantRow: TenantRow | undefined, overrides?: { create?: ReturnType<typeof vi.fn> }) {
  const queryRaw = vi.fn().mockResolvedValue(tenantRow ? [tenantRow] : [])
  const tenantUpdate =
    overrides?.create ??
    vi.fn().mockImplementation(({ data }: { data: { status: TenantStatus } }) =>
      Promise.resolve({ ...tenantRow, status: data.status }),
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

describe('PrismaAdminTenantStatusRepository — AUDIT_LOGGED 2nd emit (T-08)', () => {
  it('updated branch: emits TENANT_STATUS_CHANGED then AUDIT_LOGGED with action=TENANT_STATUS_CHANGED', async () => {
    const tenantRow: TenantRow = {
      id: 'tenant-1',
      status: 'TRIAL' as TenantStatus,
      updatedAt: new Date(),
      name: 'Acme',
      slug: 'acme',
    }
    const tx = makeMockTx(tenantRow)
    const outboxWriter = makeOutboxWriterStub()
    const repo = new PrismaAdminTenantStatusRepository({} as never, outboxWriter as never)
    const actor: CommandActor = { type: 'operator', operatorId: 'op-1' }

    await repo.updateTenantStatus(
      { tenantId: 'tenant-1', targetStatus: 'ACTIVE' as TenantStatus, actor, now: NOW },
      tx,
    )

    expect(outboxWriter.emit).toHaveBeenCalledTimes(2)

    const [firstCallTx, firstCallEvent] = outboxWriter.emit.mock.calls[0]!
    expect(firstCallTx).toBe(tx)
    expect(firstCallEvent).toMatchObject({
      eventType: 'TENANT_STATUS_CHANGED',
      tenantId: 'tenant-1',
      payload: { previousStatus: 'TRIAL', newStatus: 'ACTIVE' },
    })

    const [secondCallTx, secondCallEvent] = outboxWriter.emit.mock.calls[1]!
    expect(secondCallTx).toBe(tx)
    expect(secondCallEvent).toEqual({
      eventType: 'AUDIT_LOGGED',
      tenantId: 'tenant-1',
      payload: {
        action: 'TENANT_STATUS_CHANGED',
        previousValue: { status: 'TRIAL' },
        newValue: { status: 'ACTIVE' },
        actor: { id: 'op-1', type: 'operator', label: 'op-1' },
      },
      occurredAt: NOW,
    })
  })

  it('unchanged branch: outboxWriter.emit NOT called for either event type (regression, D4)', async () => {
    const tenantRow: TenantRow = {
      id: 'tenant-1',
      status: 'ACTIVE' as TenantStatus,
      updatedAt: new Date(),
      name: 'Acme',
      slug: 'acme',
    }
    const tx = makeMockTx(tenantRow)
    const outboxWriter = makeOutboxWriterStub()
    const repo = new PrismaAdminTenantStatusRepository({} as never, outboxWriter as never)
    const actor: CommandActor = { type: 'user', userId: 'u-1' }

    const result = await repo.updateTenantStatus(
      { tenantId: 'tenant-1', targetStatus: 'ACTIVE' as TenantStatus, actor, now: NOW },
      tx,
    )

    expect(result.status).toBe('unchanged')
    expect(outboxWriter.emit).not.toHaveBeenCalled()
  })

  it('notFound branch: outboxWriter.emit NOT called for either event type (regression, D4)', async () => {
    const tx = makeMockTx(undefined)
    const outboxWriter = makeOutboxWriterStub()
    const repo = new PrismaAdminTenantStatusRepository({} as never, outboxWriter as never)
    const actor: CommandActor = { type: 'user', userId: 'u-1' }

    const result = await repo.updateTenantStatus(
      { tenantId: 'missing-tenant', targetStatus: 'ACTIVE' as TenantStatus, actor, now: NOW },
      tx,
    )

    expect(result.status).toBe('notFound')
    expect(outboxWriter.emit).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// T-01 — RED: repo terminal-variant for CANCELLED current status (D1/D2)
//
// Spec: admin-tenant-status — CANCELLED Is Terminal — Server-Side Enforcement
//   (all 3 scenarios)
// ---------------------------------------------------------------------------

describe('PrismaAdminTenantStatusRepository — terminal variant for CANCELLED current status (D1/D2)', () => {
  const CANCELLED_ROW: TenantRow = {
    id: 'tenant-cancelled-1',
    status: 'CANCELLED' as TenantStatus,
    updatedAt: new Date('2026-03-01T00:00:00Z'),
    name: 'Cancelled Co',
    slug: 'cancelled-co',
  }

  it('CANCELLED → ACTIVE: returns terminal, tenant.update NOT called, outboxWriter.emit NOT called', async () => {
    const tx = makeMockTx(CANCELLED_ROW)
    const outboxWriter = makeOutboxWriterStub()
    const repo = new PrismaAdminTenantStatusRepository({} as never, outboxWriter as never)
    const actor: CommandActor = { type: 'operator', operatorId: 'op-1' }

    const result = await repo.updateTenantStatus(
      { tenantId: CANCELLED_ROW.id, targetStatus: 'ACTIVE' as TenantStatus, actor, now: NOW },
      tx,
    )

    expect(result).toEqual({
      status: 'terminal',
      tenantId: CANCELLED_ROW.id,
      currentStatus: 'CANCELLED',
      updatedAt: CANCELLED_ROW.updatedAt,
    })
    expect((tx as unknown as { tenant: { update: ReturnType<typeof vi.fn> } }).tenant.update).not.toHaveBeenCalled()
    expect(outboxWriter.emit).not.toHaveBeenCalled()
  })

  it('CANCELLED → SUSPENDED: returns terminal, zero writes', async () => {
    const tx = makeMockTx(CANCELLED_ROW)
    const outboxWriter = makeOutboxWriterStub()
    const repo = new PrismaAdminTenantStatusRepository({} as never, outboxWriter as never)
    const actor: CommandActor = { type: 'operator', operatorId: 'op-1' }

    const result = await repo.updateTenantStatus(
      { tenantId: CANCELLED_ROW.id, targetStatus: 'SUSPENDED' as TenantStatus, actor, now: NOW },
      tx,
    )

    expect(result).toEqual({
      status: 'terminal',
      tenantId: CANCELLED_ROW.id,
      currentStatus: 'CANCELLED',
      updatedAt: CANCELLED_ROW.updatedAt,
    })
    expect((tx as unknown as { tenant: { update: ReturnType<typeof vi.fn> } }).tenant.update).not.toHaveBeenCalled()
    expect(outboxWriter.emit).not.toHaveBeenCalled()
  })

  it('CANCELLED → CANCELLED: returns terminal (NOT unchanged:true) — proves ordering (D2)', async () => {
    const tx = makeMockTx(CANCELLED_ROW)
    const outboxWriter = makeOutboxWriterStub()
    const repo = new PrismaAdminTenantStatusRepository({} as never, outboxWriter as never)
    const actor: CommandActor = { type: 'operator', operatorId: 'op-1' }

    const result = await repo.updateTenantStatus(
      { tenantId: CANCELLED_ROW.id, targetStatus: 'CANCELLED' as TenantStatus, actor, now: NOW },
      tx,
    )

    expect(result.status).toBe('terminal')
    expect(result).not.toMatchObject({ status: 'unchanged' })
    expect((tx as unknown as { tenant: { update: ReturnType<typeof vi.fn> } }).tenant.update).not.toHaveBeenCalled()
    expect(outboxWriter.emit).not.toHaveBeenCalled()
  })
})
