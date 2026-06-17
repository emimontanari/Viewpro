/**
 * Unit tests for the WhatsApp phone use cases (Phase 3 — Stage 23.3).
 *
 * Covers:
 *   UpdateTenantWhatsappPhoneUseCase
 *     - Valid phone → persisted (normalized)
 *     - null input → null persisted
 *     - Empty string → null persisted
 *     - Whitespace-only string → null persisted
 *     - Too-short phone → phone.too_short error
 *     - Normalization strips non-[+\d] chars before persist
 *     - Normalization preserves leading +
 *
 *   GetTenantWhatsappPhoneUseCase
 *     - Returns { whatsappPhone: value } when repo returns a row
 *     - Returns { whatsappPhone: null } when repo returns null
 */

import { BadRequestException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
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
  it('persists the normalized value when a valid phone is provided (S-1)', async () => {
    const repo = buildMockRepo()
    const useCase = new UpdateTenantWhatsappPhoneUseCase(repo)

    await useCase.execute({ tenantId: TENANT_ID, whatsappPhone: '+5493510000000' })

    expect(repo.updateWhatsappPhone).toHaveBeenCalledOnce()
    expect(repo.updateWhatsappPhone).toHaveBeenCalledWith(TENANT_ID, '+5493510000000')
  })

  it('persists null when input is null (clear operation — S-2)', async () => {
    const repo = buildMockRepo()
    const useCase = new UpdateTenantWhatsappPhoneUseCase(repo)

    await useCase.execute({ tenantId: TENANT_ID, whatsappPhone: null })

    expect(repo.updateWhatsappPhone).toHaveBeenCalledWith(TENANT_ID, null)
  })

  it('persists null when input is an empty string (FR-3 clear)', async () => {
    const repo = buildMockRepo()
    const useCase = new UpdateTenantWhatsappPhoneUseCase(repo)

    await useCase.execute({ tenantId: TENANT_ID, whatsappPhone: '' })

    expect(repo.updateWhatsappPhone).toHaveBeenCalledWith(TENANT_ID, null)
  })

  it('persists null when input is whitespace-only (FR-3 clear)', async () => {
    const repo = buildMockRepo()
    const useCase = new UpdateTenantWhatsappPhoneUseCase(repo)

    await useCase.execute({ tenantId: TENANT_ID, whatsappPhone: '   ' })

    expect(repo.updateWhatsappPhone).toHaveBeenCalledWith(TENANT_ID, null)
  })

  it('throws BadRequestException with code phone.too_short when digit count < 8 (S-3, FR-4)', async () => {
    const repo = buildMockRepo()
    const useCase = new UpdateTenantWhatsappPhoneUseCase(repo)

    await expect(
      useCase.execute({ tenantId: TENANT_ID, whatsappPhone: '123' }),
    ).rejects.toMatchObject({
      response: { errorCode: 'phone.too_short' },
    })
    expect(repo.updateWhatsappPhone).not.toHaveBeenCalled()
  })

  it('normalizes by stripping non-[+\\d] characters before persisting (D2)', async () => {
    const repo = buildMockRepo()
    const useCase = new UpdateTenantWhatsappPhoneUseCase(repo)

    // Input: " +54 9 351-000-0000 " → normalized: "+5493510000000"
    await useCase.execute({ tenantId: TENANT_ID, whatsappPhone: ' +54 9 351-000-0000 ' })

    expect(repo.updateWhatsappPhone).toHaveBeenCalledWith(TENANT_ID, '+5493510000000')
  })

  it('preserves the leading + during normalization (D2, FR-5)', async () => {
    const repo = buildMockRepo()
    const useCase = new UpdateTenantWhatsappPhoneUseCase(repo)

    await useCase.execute({ tenantId: TENANT_ID, whatsappPhone: '+5493510000000' })

    const [[, persistedValue]] = (repo.updateWhatsappPhone as ReturnType<typeof vi.fn>).mock.calls
    expect(persistedValue).toMatch(/^\+/)
  })

  it('does not add a leading + when the input has none (D2)', async () => {
    const repo = buildMockRepo()
    const useCase = new UpdateTenantWhatsappPhoneUseCase(repo)

    await useCase.execute({ tenantId: TENANT_ID, whatsappPhone: '5493510000000' })

    expect(repo.updateWhatsappPhone).toHaveBeenCalledWith(TENANT_ID, '5493510000000')
  })

  it('throws BadRequestException (not another type) for the too-short case', async () => {
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
