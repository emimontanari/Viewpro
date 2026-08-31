import { UnauthorizedException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GetCurrentUserUseCase } from '../use-cases/get-current-user.use-case'

// ---------------------------------------------------------------------------
// Spec: GetCurrentUserUseCase — the session payload the whole frontend routes on.
//
// It reported memberships and nothing about owner access, so a user who is both
// a seller and a property owner was indistinguishable from a seller. Post-login
// routing sent them to /dashboard and the dashboard sidebar carries no link to
// /owner (#326).
// ---------------------------------------------------------------------------

const user = {
  id: 'user-1',
  email: 'both@example.com',
  firstName: 'Ana',
  lastName: 'García',
  status: 'ACTIVE',
  globalRole: 'USER',
  emailVerifiedAt: new Date(),
}

const membership = {
  id: 'membership-1',
  role: 'MANAGER',
  tenant: { id: 'tenant-1', name: 'Sur', slug: 'sur', status: 'ACTIVE' },
}

describe('GetCurrentUserUseCase', () => {
  let findById: ReturnType<typeof vi.fn>
  let findActiveManyByUserId: ReturnType<typeof vi.fn>
  let hasActiveOwnerAccess: ReturnType<typeof vi.fn>
  let useCase: GetCurrentUserUseCase

  beforeEach(() => {
    findById = vi.fn().mockResolvedValue(user)
    findActiveManyByUserId = vi.fn().mockResolvedValue([])
    hasActiveOwnerAccess = vi.fn().mockResolvedValue(false)
    useCase = new GetCurrentUserUseCase(
      { findById } as never,
      { findActiveManyByUserId } as never,
      { hasActiveOwnerAccess } as never,
    )
  })

  it('reports owner access when the user holds an active owner link', async () => {
    hasActiveOwnerAccess.mockResolvedValue(true)

    const response = await useCase.execute('user-1')

    expect(response.hasOwnerAccess).toBe(true)
    expect(hasActiveOwnerAccess).toHaveBeenCalledWith('user-1')
  })

  it('reports no owner access when the user holds none', async () => {
    expect((await useCase.execute('user-1')).hasOwnerAccess).toBe(false)
  })

  it('reports both contexts for a dual-context user', async () => {
    // The case the whole issue is about: today this user is routed as a seller
    // and never offered the owner portal.
    findActiveManyByUserId.mockResolvedValue([membership])
    hasActiveOwnerAccess.mockResolvedValue(true)

    const response = await useCase.execute('user-1')

    expect(response.memberships).toHaveLength(1)
    expect(response.hasOwnerAccess).toBe(true)
  })

  it('refuses a user whose account is not active, before asking about access', async () => {
    findById.mockResolvedValue({ ...user, status: 'SUSPENDED' })

    await expect(useCase.execute('user-1')).rejects.toBeInstanceOf(UnauthorizedException)
    expect(hasActiveOwnerAccess).not.toHaveBeenCalled()
  })

  it('refuses when the user row is gone', async () => {
    findById.mockResolvedValue(null)

    await expect(useCase.execute('user-1')).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('reports a boolean and never the owner records themselves', async () => {
    // The session is read by the browser. Whether a portal exists is all the
    // routing needs; which properties are behind it is the portal's own
    // authorised call.
    hasActiveOwnerAccess.mockResolvedValue(true)

    const response = await useCase.execute('user-1') as Record<string, unknown>

    expect(typeof response.hasOwnerAccess).toBe('boolean')
    expect(response).not.toHaveProperty('owners')
    expect(response).not.toHaveProperty('propertyAssetOwners')
  })
})
