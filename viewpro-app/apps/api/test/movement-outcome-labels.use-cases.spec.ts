import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { TenantRole } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import type { MovementOutcomeLabelsRepository } from '../src/movement-outcome-labels/movement-outcome-labels.repository'
import { CreateLabelUseCase } from '../src/movement-outcome-labels/use-cases/create-label.use-case'
import { DeleteLabelUseCase } from '../src/movement-outcome-labels/use-cases/delete-label.use-case'
import { ListLabelsUseCase } from '../src/movement-outcome-labels/use-cases/list-labels.use-case'

const tenantContext = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  role: TenantRole.AGENT,
  permissions: ['movements.outcome_labels.manage', 'tenant.view'],
  membershipId: 'membership-1',
}

const currentUser = { id: 'user-1', email: 'agent@example.com' }

const existingLabel = {
  id: 'label-1',
  tenantId: 'tenant-1',
  label: 'Espera doc',
  color: '#3B82F6',
  createdByUserId: 'user-1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null,
}

function buildMockRepo(overrides: Partial<MovementOutcomeLabelsRepository> = {}): MovementOutcomeLabelsRepository {
  return {
    create: vi.fn().mockResolvedValue(existingLabel),
    findActive: vi.fn().mockResolvedValue(null),
    findByIdForTenant: vi.fn().mockResolvedValue(existingLabel),
    findMany: vi.fn().mockResolvedValue([existingLabel]),
    softDelete: vi.fn().mockResolvedValue(existingLabel),
    ...overrides,
  }
}

// ─── CreateLabelUseCase ───────────────────────────────────────────────────────

describe('CreateLabelUseCase', () => {
  it('creates a label when input is valid (S-2)', async () => {
    const repo = buildMockRepo()
    const useCase = new CreateLabelUseCase(repo)

    const result = await useCase.execute(tenantContext as any, currentUser as any, {
      label: 'Espera doc',
      color: '#3B82F6',
    })

    expect(result).toEqual(existingLabel)
    expect(repo.create).toHaveBeenCalledOnce()
  })

  it('rejects when label name collides with a built-in outcome (S-11)', async () => {
    const repo = buildMockRepo()
    const useCase = new CreateLabelUseCase(repo)

    await expect(
      useCase.execute(tenantContext as any, currentUser as any, {
        label: 'EN_CAPTACION',
      }),
    ).rejects.toThrow(UnprocessableEntityException)
  })

  it('rejects case-insensitively for built-in collision (S-11)', async () => {
    const repo = buildMockRepo()
    const useCase = new CreateLabelUseCase(repo)

    await expect(
      useCase.execute(tenantContext as any, currentUser as any, {
        label: 'en_captacion',
      }),
    ).rejects.toThrow(UnprocessableEntityException)
  })

  it('returns existing active label on duplicate name — P2002 handled by adapter (S-12, FR-13)', async () => {
    // The P2002 catch + re-query lives in the Prisma adapter (R2 strategy),
    // so the use case just calls create() and receives the already-deduplicated row.
    const repo = buildMockRepo({
      create: vi.fn().mockResolvedValue(existingLabel),
    })
    const useCase = new CreateLabelUseCase(repo)

    const result = await useCase.execute(tenantContext as any, currentUser as any, {
      label: 'Espera doc',
    })

    expect(result).toEqual(existingLabel)
    expect(repo.create).toHaveBeenCalledOnce()
  })

  it('creates a new row when soft-deleted label with same name exists (S-3 edge)', async () => {
    // findActive returns null (no active row) — P2002 not thrown because partial index only covers active rows
    const repo = buildMockRepo({
      create: vi.fn().mockResolvedValue({ ...existingLabel, id: 'label-2' }),
      findActive: vi.fn().mockResolvedValue(null),
    })
    const useCase = new CreateLabelUseCase(repo)

    const result = await useCase.execute(tenantContext as any, currentUser as any, {
      label: 'Espera doc',
    })

    expect(result.id).toBe('label-2')
    expect(repo.create).toHaveBeenCalledOnce()
  })

  it('bubbles unexpected errors from repository', async () => {
    const repo = buildMockRepo({
      create: vi.fn().mockRejectedValue(new Error('DB connection error')),
    })
    const useCase = new CreateLabelUseCase(repo)

    await expect(
      useCase.execute(tenantContext as any, currentUser as any, { label: 'Valid label' }),
    ).rejects.toThrow('DB connection error')
  })
})

// ─── DeleteLabelUseCase ───────────────────────────────────────────────────────

describe('DeleteLabelUseCase', () => {
  it('soft-deletes a label when caller is the creator (S-14 — creator can delete)', async () => {
    const repo = buildMockRepo()
    const useCase = new DeleteLabelUseCase(repo)

    await useCase.execute(tenantContext as any, currentUser as any, 'label-1')

    expect(repo.softDelete).toHaveBeenCalledWith({ id: 'label-1', tenantId: 'tenant-1' })
  })

  it('soft-deletes a label when caller is a MANAGER (S-15)', async () => {
    const managerContext = { ...tenantContext, role: TenantRole.MANAGER }
    const otherUser = { id: 'other-user', email: 'manager@example.com' }
    const repo = buildMockRepo({
      findByIdForTenant: vi.fn().mockResolvedValue({ ...existingLabel, createdByUserId: 'creator-user' }),
    })
    const useCase = new DeleteLabelUseCase(repo)

    await useCase.execute(managerContext as any, otherUser as any, 'label-1')

    expect(repo.softDelete).toHaveBeenCalledOnce()
  })

  it('soft-deletes a label when caller is a PRINCIPAL_MANAGER (S-15)', async () => {
    const pmContext = { ...tenantContext, role: TenantRole.PRINCIPAL_MANAGER }
    const otherUser = { id: 'other-user', email: 'pm@example.com' }
    const repo = buildMockRepo({
      findByIdForTenant: vi.fn().mockResolvedValue({ ...existingLabel, createdByUserId: 'creator-user' }),
    })
    const useCase = new DeleteLabelUseCase(repo)

    await useCase.execute(pmContext as any, otherUser as any, 'label-1')

    expect(repo.softDelete).toHaveBeenCalledOnce()
  })

  it('rejects when caller is an AGENT who did not create the label (S-14)', async () => {
    const repo = buildMockRepo({
      findByIdForTenant: vi.fn().mockResolvedValue({ ...existingLabel, createdByUserId: 'another-user' }),
    })
    const useCase = new DeleteLabelUseCase(repo)

    await expect(
      useCase.execute(tenantContext as any, { id: 'not-the-creator', email: 'x@example.com' } as any, 'label-1'),
    ).rejects.toThrow(ForbiddenException)
  })

  it('throws 404 when label does not belong to tenant', async () => {
    const repo = buildMockRepo({ findByIdForTenant: vi.fn().mockResolvedValue(null) })
    const useCase = new DeleteLabelUseCase(repo)

    await expect(
      useCase.execute(tenantContext as any, currentUser as any, 'unknown-id'),
    ).rejects.toThrow(NotFoundException)
  })

  it('throws 409 when label is already soft-deleted', async () => {
    const repo = buildMockRepo({
      findByIdForTenant: vi.fn().mockResolvedValue({ ...existingLabel, deletedAt: new Date() }),
    })
    const useCase = new DeleteLabelUseCase(repo)

    await expect(
      useCase.execute(tenantContext as any, currentUser as any, 'label-1'),
    ).rejects.toThrow(ConflictException)
  })
})

// ─── ListLabelsUseCase ────────────────────────────────────────────────────────

describe('ListLabelsUseCase', () => {
  it('returns only active labels when activeOnly=true (S-5)', async () => {
    const softDeletedLabel = { ...existingLabel, deletedAt: new Date() }
    const repo = buildMockRepo({
      findMany: vi.fn().mockResolvedValue([existingLabel]),
    })
    const useCase = new ListLabelsUseCase(repo)

    const result = await useCase.execute(tenantContext as any, { activeOnly: true })

    expect(result).toHaveLength(1)
    expect(result[0].deletedAt).toBeNull()
    expect(repo.findMany).toHaveBeenCalledWith({ tenantId: 'tenant-1', activeOnly: true })
  })

  it('returns all labels when activeOnly=false', async () => {
    const softDeletedLabel = { ...existingLabel, id: 'label-2', deletedAt: new Date() }
    const repo = buildMockRepo({
      findMany: vi.fn().mockResolvedValue([existingLabel, softDeletedLabel]),
    })
    const useCase = new ListLabelsUseCase(repo)

    const result = await useCase.execute(tenantContext as any, { activeOnly: false })

    expect(result).toHaveLength(2)
    expect(repo.findMany).toHaveBeenCalledWith({ tenantId: 'tenant-1', activeOnly: false })
  })
})
