/**
 * Unit tests for the WhatsApp phone use cases.
 *
 * Covers:
 *   UpdateTenantWhatsappPhoneUseCase (#287 WU4 — settings parity, ADR-6)
 *     - Valid phone → persisted as canonical E.164
 *     - null / empty / whitespace-only → phone.required (mandatory now, no clear path)
 *     - Unparseable phone → phone.invalid
 *     - Valid non-AR phone → phone.country_unsupported
 *     - National-form legacy value canonicalizes on unedited re-save
 *     - Already-canonical E.164 input round-trips unchanged
 *
 *   GetTenantWhatsappPhoneUseCase
 *     - Returns { whatsappPhone: value } when repo returns a row
 *     - Returns { whatsappPhone: null } when repo returns null
 */

import { BadRequestException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { PrismaTenantsRepository } from '../src/tenants/prisma-tenants.repository'
import type { TenantsRepository } from '../src/tenants/tenants.repository'
import { GetTenantWhatsappPhoneUseCase } from '../src/tenants/use-cases/get-tenant-whatsapp-phone.use-case'
import { UpdateTenantWhatsappPhoneUseCase } from '../src/tenants/use-cases/update-tenant-whatsapp-phone.use-case'

const TENANT_ID = 'tenant-uuid-123'

function buildMockRepo(overrides: Partial<TenantsRepository> = {}): TenantsRepository {
  return {
    create: vi.fn(),
    findBySlug: vi.fn(),
    findWhatsappPhone: vi.fn().mockResolvedValue(null),
    updateWhatsappPhone: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

// ─── UpdateTenantWhatsappPhoneUseCase ─────────────────────────────────────────

describe('UpdateTenantWhatsappPhoneUseCase', () => {
  it('persists the canonical E.164 value when a valid phone is provided (S-1)', async () => {
    const repo = buildMockRepo()
    const useCase = new UpdateTenantWhatsappPhoneUseCase(repo)

    await useCase.execute({ tenantId: TENANT_ID, whatsappPhone: '+5493510000000' })

    expect(repo.updateWhatsappPhone).toHaveBeenCalledOnce()
    expect(repo.updateWhatsappPhone).toHaveBeenCalledWith(TENANT_ID, '+5493510000000')
  })

  // Inverted (S-2): null used to clear the stored phone; the field is now
  // mandatory, so null is rejected the same way registration rejects it.
  it('throws phone.required when input is null (mandatory now — INVERTED S-2)', async () => {
    const repo = buildMockRepo()
    const useCase = new UpdateTenantWhatsappPhoneUseCase(repo)

    await expect(
      useCase.execute({ tenantId: TENANT_ID, whatsappPhone: null }),
    ).rejects.toMatchObject({ response: { errorCode: 'phone.required' } })
    expect(repo.updateWhatsappPhone).not.toHaveBeenCalled()
  })

  // Inverted (FR-3): empty string used to clear the stored phone.
  it('throws phone.required when input is an empty string (INVERTED FR-3)', async () => {
    const repo = buildMockRepo()
    const useCase = new UpdateTenantWhatsappPhoneUseCase(repo)

    await expect(
      useCase.execute({ tenantId: TENANT_ID, whatsappPhone: '' }),
    ).rejects.toMatchObject({ response: { errorCode: 'phone.required' } })
    expect(repo.updateWhatsappPhone).not.toHaveBeenCalled()
  })

  // Inverted (FR-3): whitespace-only used to clear the stored phone.
  it('throws phone.required when input is whitespace-only (INVERTED FR-3)', async () => {
    const repo = buildMockRepo()
    const useCase = new UpdateTenantWhatsappPhoneUseCase(repo)

    await expect(
      useCase.execute({ tenantId: TENANT_ID, whatsappPhone: '   ' }),
    ).rejects.toMatchObject({ response: { errorCode: 'phone.required' } })
    expect(repo.updateWhatsappPhone).not.toHaveBeenCalled()
  })

  // Inverted (S-3, FR-4): the digit-count `phone.too_short` check is gone;
  // `parseArContactPhone` rejects the same input as an unparseable AR number.
  it('throws phone.invalid for an unparseable phone (INVERTED S-3, FR-4)', async () => {
    const repo = buildMockRepo()
    const useCase = new UpdateTenantWhatsappPhoneUseCase(repo)

    await expect(
      useCase.execute({ tenantId: TENANT_ID, whatsappPhone: '123' }),
    ).rejects.toMatchObject({ response: { errorCode: 'phone.invalid' } })
    expect(repo.updateWhatsappPhone).not.toHaveBeenCalled()
  })

  it('throws phone.country_unsupported for a valid non-AR phone', async () => {
    const repo = buildMockRepo()
    const useCase = new UpdateTenantWhatsappPhoneUseCase(repo)

    await expect(
      useCase.execute({ tenantId: TENANT_ID, whatsappPhone: '+56912345678' }),
    ).rejects.toMatchObject({ response: { errorCode: 'phone.country_unsupported' } })
    expect(repo.updateWhatsappPhone).not.toHaveBeenCalled()
  })

  it('canonicalizes a legacy national-form value the same way registration does (D2)', async () => {
    // Input: "+54 9 351-000-0000" → canonical: "+5493510000000"
    const repo = buildMockRepo()
    const useCase = new UpdateTenantWhatsappPhoneUseCase(repo)

    await useCase.execute({ tenantId: TENANT_ID, whatsappPhone: '+54 9 351-000-0000' })

    expect(repo.updateWhatsappPhone).toHaveBeenCalledWith(TENANT_ID, '+5493510000000')
  })

  it('preserves the leading + on an already-canonical E.164 input', async () => {
    const repo = buildMockRepo()
    const useCase = new UpdateTenantWhatsappPhoneUseCase(repo)

    await useCase.execute({ tenantId: TENANT_ID, whatsappPhone: '+5493510000000' })

    const [[, persistedValue]] = (repo.updateWhatsappPhone as ReturnType<typeof vi.fn>).mock.calls
    expect(persistedValue).toMatch(/^\+/)
  })

  // Inverted (D2): the old assertion pinned "no leading + when input has
  // none" as a literal pass-through; parseArContactPhone always canonicalizes
  // to E.164, so a bare national-form digit string now GAINS the leading +.
  // This is the exact legacy re-save case the manager must keep working
  // (design.md ADR-1, ADR-6): a stored national-form value like "3510000000"
  // must canonicalize on unedited re-save, not 400 with phone.invalid.
  it('canonicalizes a bare national-form legacy value on unedited re-save (INVERTED D2)', async () => {
    const repo = buildMockRepo()
    const useCase = new UpdateTenantWhatsappPhoneUseCase(repo)

    await useCase.execute({ tenantId: TENANT_ID, whatsappPhone: '3510000000' })

    expect(repo.updateWhatsappPhone).toHaveBeenCalledWith(TENANT_ID, '+543510000000')
  })

  it('throws BadRequestException (not another type) for the invalid case', async () => {
    const repo = buildMockRepo()
    const useCase = new UpdateTenantWhatsappPhoneUseCase(repo)

    await expect(
      useCase.execute({ tenantId: TENANT_ID, whatsappPhone: '1234567' }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})

// ─── GetTenantWhatsappPhoneUseCase ────────────────────────────────────────────

describe('GetTenantWhatsappPhoneUseCase', () => {
  it('returns { whatsappPhone: value } when the repo returns a record', async () => {
    const repo = buildMockRepo({
      findWhatsappPhone: vi.fn().mockResolvedValue({ whatsappPhone: '+5493510000000' }),
    })
    const useCase = new GetTenantWhatsappPhoneUseCase(repo)

    const result = await useCase.execute({ tenantId: TENANT_ID })

    expect(result).toEqual({ whatsappPhone: '+5493510000000' })
  })

  it('returns { whatsappPhone: null } when the repo returns null (tenant not found or unset)', async () => {
    const repo = buildMockRepo({
      findWhatsappPhone: vi.fn().mockResolvedValue(null),
    })
    const useCase = new GetTenantWhatsappPhoneUseCase(repo)

    const result = await useCase.execute({ tenantId: TENANT_ID })

    expect(result).toEqual({ whatsappPhone: null })
  })

  it('returns { whatsappPhone: null } when repo returns a record with null whatsappPhone', async () => {
    const repo = buildMockRepo({
      findWhatsappPhone: vi.fn().mockResolvedValue({ whatsappPhone: null }),
    })
    const useCase = new GetTenantWhatsappPhoneUseCase(repo)

    const result = await useCase.execute({ tenantId: TENANT_ID })

    expect(result).toEqual({ whatsappPhone: null })
  })
})

describe('PrismaTenantsRepository — the settings write never touches the personal phone (#287)', () => {
  it('writes only to tenant, never to user', async () => {
    const tenantUpdate = vi.fn().mockResolvedValue({ id: 'tenant-1' })
    const userUpdate = vi.fn()

    const prisma = {
      tenant: { update: tenantUpdate },
      user: { update: userUpdate },
    }

    const repository = new PrismaTenantsRepository(prisma as never)
    await repository.updateWhatsappPhone('tenant-1', '+543510000000')

    // The registration half of this requirement is pinned in
    // register-tenant.use-cases.spec.ts; this is its settings twin. Structure
    // makes the violation impossible today — the repository injects only
    // Prisma and issues a single tenant.update — but structure is not proof,
    // and the agency contact and the personal seller number must stay
    // separate on both write paths.
    expect(tenantUpdate).toHaveBeenCalledTimes(1)
    expect(tenantUpdate.mock.calls[0]![0]).toMatchObject({
      where: { id: 'tenant-1' },
      data: { whatsappPhone: '+543510000000' },
    })
    expect(userUpdate).not.toHaveBeenCalled()
  })
})
