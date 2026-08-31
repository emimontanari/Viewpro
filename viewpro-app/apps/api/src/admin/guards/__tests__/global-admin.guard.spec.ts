import { ForbiddenException, UnauthorizedException } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GlobalAdminGuard } from '../global-admin.guard'

// ---------------------------------------------------------------------------
// Spec: GlobalAdminGuard — the only thing standing between a request and the
// global admin console.
//
// The frontend now mirrors this guard (app-new's /admin layout, #307), which
// is exactly why it needs its own proof: a UI mirror is worthless if the thing
// it mirrors is unverified, and the mirror is not authorization either way.
// ---------------------------------------------------------------------------

function makeContext(user?: { id: string }): ExecutionContext {
  const request: Record<string, unknown> = user ? { user } : {}
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext
}

const admin = { id: 'user-1', status: 'ACTIVE', globalRole: 'VIEWPRO_ADMIN' }

describe('GlobalAdminGuard', () => {
  let findById: ReturnType<typeof vi.fn>
  let guard: GlobalAdminGuard

  beforeEach(() => {
    findById = vi.fn()
    guard = new GlobalAdminGuard({ findById } as never)
  })

  it('lets an active ViewPro admin through', async () => {
    findById.mockResolvedValue(admin)

    await expect(guard.canActivate(makeContext({ id: 'user-1' }))).resolves.toBe(true)
    expect(findById).toHaveBeenCalledWith('user-1')
  })

  it('refuses an unauthenticated request before touching the repository', async () => {
    await expect(guard.canActivate(makeContext())).rejects.toBeInstanceOf(UnauthorizedException)
    expect(findById).not.toHaveBeenCalled()
  })

  it('refuses a plain user, whatever their account status', async () => {
    for (const status of ['ACTIVE', 'SUSPENDED']) {
      findById.mockResolvedValue({ ...admin, globalRole: 'USER', status })

      await expect(guard.canActivate(makeContext({ id: 'user-1' }))).rejects.toBeInstanceOf(
        ForbiddenException,
      )
    }
  })

  it('refuses an admin whose account is no longer active', async () => {
    // The role alone is not enough: a suspended admin keeps the role in the
    // row, so checking only globalRole would leave them full access.
    for (const status of ['SUSPENDED', 'DEACTIVATED', 'PENDING_VERIFICATION']) {
      findById.mockResolvedValue({ ...admin, status })

      await expect(guard.canActivate(makeContext({ id: 'user-1' }))).rejects.toBeInstanceOf(
        ForbiddenException,
      )
    }
  })

  it('refuses when the user row is gone, rather than trusting the request', async () => {
    // The id arrives from a verified token, but the row behind it may have been
    // deleted since. A missing row is a refusal, not an absence of opinion.
    findById.mockResolvedValue(null)

    await expect(guard.canActivate(makeContext({ id: 'user-1' }))).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it('does not leak why it refused', async () => {
    // 'ViewPro admin access required' is the same answer for a plain user, a
    // suspended admin and a deleted row: none of them learns which it was.
    findById.mockResolvedValue({ ...admin, globalRole: 'USER' })
    const forPlainUser = await guard.canActivate(makeContext({ id: 'user-1' })).catch((e) => e)

    findById.mockResolvedValue(null)
    const forMissingRow = await guard.canActivate(makeContext({ id: 'user-1' })).catch((e) => e)

    expect(forPlainUser.message).toBe(forMissingRow.message)
  })
})
