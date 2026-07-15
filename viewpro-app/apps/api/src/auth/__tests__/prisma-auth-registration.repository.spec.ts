import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TenantRole } from '@prisma/client'
import type { Prisma } from '@prisma/client'

// ---------------------------------------------------------------------------
// T-08 — RED: unit tests — PrismaAuthRegistrationRepository emits TENANT_REGISTERED
//
// Spec: tenant-registry — Registration Event Transactional Emit
//   - After successful registerTenant tx: outboxWriter.emit called once with
//     eventType='TENANT_REGISTERED', correct tenantId, full payload fields
//   - After rolled-back tx (mock tenant.create throws): outboxWriter.emit NOT called
//
// Design A4: emit is inside the same $transaction after tenant.create.
// ---------------------------------------------------------------------------

// Lazy import: module may not yet have the writer injected (RED phase)
type RegistrationRepoClass =
  import('../repositories/prisma-auth-registration.repository.js').PrismaAuthRegistrationRepository

let PrismaAuthRegistrationRepository: new (...args: any[]) => RegistrationRepoClass

beforeEach(async () => {
  const mod = await import('../repositories/prisma-auth-registration.repository.js')
  PrismaAuthRegistrationRepository = mod.PrismaAuthRegistrationRepository
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-reg-001'
const USER_ID = 'user-reg-001'

const mockTenant = {
  id: TENANT_ID,
  name: 'Acme Corp',
  slug: 'acme-corp',
  status: 'TRIAL' as const,
  maxUsers: 10,
  maxActivePropertyEngagements: null,
  maxDocumentsStorageMb: 500,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockUser = {
  id: USER_ID,
  email: 'owner@acme.com',
  firstName: 'Alice',
  lastName: 'Smith',
  passwordHash: 'hashed',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockMembership = {
  id: 'membership-001',
  userId: USER_ID,
  tenantId: TENANT_ID,
  role: TenantRole.PRINCIPAL_MANAGER,
  createdAt: new Date(),
  updatedAt: new Date(),
  tenant: mockTenant,
}

function makeMockOutboxWriter() {
  return { emit: vi.fn().mockResolvedValue(undefined) }
}

function makeMockPrismaService(overrides?: {
  tenantCreate?: ReturnType<typeof vi.fn>
  membershipCreate?: ReturnType<typeof vi.fn>
}) {
  const tenantCreate = overrides?.tenantCreate ?? vi.fn().mockResolvedValue(mockTenant)
  const membershipCreate = overrides?.membershipCreate ?? vi.fn().mockResolvedValue(mockMembership)

  const mockTx: Partial<Prisma.TransactionClient> = {
    user: { create: vi.fn().mockResolvedValue(mockUser) } as any,
    tenant: { create: tenantCreate } as any,
    tenantMembership: { create: membershipCreate } as any,
  }

  return {
    $transaction: vi.fn().mockImplementation(async (fn: (tx: Prisma.TransactionClient) => Promise<any>) => {
      return fn(mockTx as Prisma.TransactionClient)
    }),
  }
}

function makeMockPrismaServiceWithRollback() {
  const mockTx: Partial<Prisma.TransactionClient> = {
    user: { create: vi.fn().mockResolvedValue(mockUser) } as any,
    tenant: { create: vi.fn().mockRejectedValue(new Error('unique slug constraint violation')) } as any,
    tenantMembership: { create: vi.fn() } as any,
  }

  return {
    $transaction: vi.fn().mockImplementation(async (fn: (tx: Prisma.TransactionClient) => Promise<any>) => {
      // Simulate rollback: just propagate the error (transaction aborts)
      return fn(mockTx as Prisma.TransactionClient)
    }),
  }
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

describe('PrismaAuthRegistrationRepository — TENANT_REGISTERED emit (T-08/T-09)', () => {
  it('successful registerTenant: outboxWriter.emit called once with TENANT_REGISTERED + full payload', async () => {
    const mockPrisma = makeMockPrismaService()
    const mockWriter = makeMockOutboxWriter()

    // Construction requires both prisma and outboxWriter (injected after T-09)
    // For RED phase: test fails if constructor doesn't accept writer
    let repo: RegistrationRepoClass
    try {
      repo = new PrismaAuthRegistrationRepository(mockPrisma as any, mockWriter as any)
    } catch {
      // If constructor doesn't accept two args yet, create with one and manually set
      repo = new PrismaAuthRegistrationRepository(mockPrisma as any)
    }

    await repo.registerTenant({
      email: 'owner@acme.com',
      passwordHash: 'hashed',
      firstName: 'Alice',
      lastName: 'Smith',
      tenantName: 'Acme Corp',
      tenantSlug: 'acme-corp',
      role: TenantRole.PRINCIPAL_MANAGER,
    })

    // A4: emit must be called once
    expect(mockWriter.emit).toHaveBeenCalledOnce()

    const [_tx, emittedEvent] = mockWriter.emit.mock.calls[0]!
    expect(emittedEvent.eventType).toBe('TENANT_REGISTERED')
    expect(emittedEvent.tenantId).toBe(TENANT_ID)
    expect(emittedEvent.payload.id).toBe(TENANT_ID)
    expect(emittedEvent.payload.name).toBe('Acme Corp')
    expect(emittedEvent.payload.slug).toBe('acme-corp')
    expect(emittedEvent.payload.newStatus).toBe('TRIAL')
    expect(emittedEvent.payload.limits).toEqual({
      maxUsers: 10,
      maxActivePropertyEngagements: null,
      maxDocumentsStorageMb: 500,
    })
    expect(emittedEvent.occurredAt).toBeDefined()
  })

  it('rolled-back tx (tenant.create throws): outboxWriter.emit NOT called', async () => {
    const mockPrisma = makeMockPrismaServiceWithRollback()
    const mockWriter = makeMockOutboxWriter()

    let repo: RegistrationRepoClass
    try {
      repo = new PrismaAuthRegistrationRepository(mockPrisma as any, mockWriter as any)
    } catch {
      repo = new PrismaAuthRegistrationRepository(mockPrisma as any)
    }

    await expect(
      repo.registerTenant({
        email: 'owner@acme.com',
        passwordHash: 'hashed',
        firstName: 'Alice',
        lastName: 'Smith',
        tenantName: 'Acme Corp',
        tenantSlug: 'acme-corp',
        role: TenantRole.PRINCIPAL_MANAGER,
      }),
    ).rejects.toThrow('unique slug constraint violation')

    // A4: rollback → no emit
    expect(mockWriter.emit).not.toHaveBeenCalled()
  })
})
