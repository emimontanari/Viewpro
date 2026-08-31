import { describe, expect, it, vi } from 'vitest'
import { PrismaOwnerAccessRepository } from './prisma-owner-access.repository'

// ---------------------------------------------------------------------------
// Spec: PrismaOwnerAccessRepository — the question post-login routing asks.
//
// The predicate must match the one the owner portal's own listings use, or the
// chooser can offer a portal that renders nothing, or hide one that has
// properties in it (#326). Both now import the same `activeOwnerAccess`.
// ---------------------------------------------------------------------------

const build = (count: number) => {
  const propertyAsset = { count: vi.fn().mockResolvedValue(count) }
  return {
    repository: new PrismaOwnerAccessRepository({ propertyAsset } as never),
    propertyAsset,
  }
}

describe('PrismaOwnerAccessRepository', () => {
  it('answers true when the user holds at least one active owner link', async () => {
    const { repository } = build(1)

    await expect(repository.hasActiveOwnerAccess('user-1')).resolves.toBe(true)
  })

  it('answers false when the user holds none', async () => {
    const { repository } = build(0)

    await expect(repository.hasActiveOwnerAccess('user-1')).resolves.toBe(false)
  })

  it('asks only about ACTIVE owner links for that exact user', async () => {
    // An INVITED link is not access yet: the invitation has not been accepted,
    // so offering that user an owner portal would send them somewhere empty.
    const { repository, propertyAsset } = build(1)

    await repository.hasActiveOwnerAccess('user-1')

    expect(propertyAsset.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { owners: { some: { userId: 'user-1', accessStatus: 'ACTIVE' } } },
      }),
    )
  })

  it('stops at the first match instead of counting a whole portfolio', async () => {
    const { repository, propertyAsset } = build(1)

    await repository.hasActiveOwnerAccess('user-1')

    expect(propertyAsset.count).toHaveBeenCalledWith(expect.objectContaining({ take: 1 }))
  })
})
