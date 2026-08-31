import { ForbiddenException, UnauthorizedException } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TenantContextStore } from '../tenant-context.store'
import { TenantMembershipGuard } from '../tenant-membership.guard'

// ---------------------------------------------------------------------------
// Spec: TenantMembershipGuard — the tenant boundary for every protected route.
//
// app-new's navigation now mirrors the tenant-status half of this guard (#307
// slice 2). The mirror is UX; this is the boundary, and until now it had no
// test of its own.
// ---------------------------------------------------------------------------

type Ctx = { ctx: ExecutionContext; request: Record<string, unknown> }

// `null` means "no user", never `undefined`: passing an explicit `undefined`
// to a defaulted parameter selects the default, so the request would still
// carry a user and this helper would quietly test the wrong thing.
function makeContext(tenantId?: string, user: { id: string } | null = { id: 'user-1' }): Ctx {
  const request: Record<string, unknown> = {
    header: (name: string) => (name === 'x-tenant-id' ? tenantId : undefined),
  }
  if (user) request.user = user
  return {
    ctx: { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext,
    request,
  }
}

const membership = (overrides: Record<string, unknown> = {}) => ({
  id: 'membership-1',
  role: 'MANAGER',
  user: { status: 'ACTIVE' },
  tenant: { id: 'tenant-1', slug: 'agency-one', status: 'ACTIVE' },
  ...overrides,
})

describe('TenantMembershipGuard', () => {
  let findActive: ReturnType<typeof vi.fn>
  let store: TenantContextStore
  let guard: TenantMembershipGuard

  beforeEach(() => {
    findActive = vi.fn()
    // The store wraps AsyncLocalStorage through nestjs-cls; the guard only ever
    // calls setTenantId, so a stub of that one method is the whole dependency.
    store = new TenantContextStore({ set: vi.fn() } as never)
    vi.spyOn(store, 'setTenantId').mockImplementation(() => undefined)
    guard = new TenantMembershipGuard({ findActiveByUserIdAndTenantId: findActive } as never, store)
  })

  it('admits an active membership in an active tenant and publishes the context', async () => {
    findActive.mockResolvedValue(membership())
    const { ctx, request } = makeContext('tenant-1')

    await expect(guard.canActivate(ctx)).resolves.toBe(true)
    expect(request.tenantContext).toMatchObject({
      tenantId: 'tenant-1',
      tenantSlug: 'agency-one',
      role: 'MANAGER',
    })
    // The isolation backstop: the Prisma layer reads the tenant id from here,
    // so a guard that admits without setting it would leave that unenforced.
    expect(store.setTenantId).toHaveBeenCalledWith('tenant-1')
  })

  it('admits a TRIAL tenant, which is an operating state', async () => {
    findActive.mockResolvedValue(membership({ tenant: { id: 't', slug: 's', status: 'TRIAL' } }))

    await expect(guard.canActivate(makeContext('t').ctx)).resolves.toBe(true)
  })

  it('refuses a suspended or cancelled tenant', async () => {
    for (const status of ['SUSPENDED', 'CANCELLED']) {
      findActive.mockResolvedValue(membership({ tenant: { id: 't', slug: 's', status } }))

      await expect(guard.canActivate(makeContext('t').ctx)).rejects.toBeInstanceOf(
        ForbiddenException,
      )
    }
  })

  it('refuses an unauthenticated request before reading any header', async () => {
    await expect(guard.canActivate(makeContext('tenant-1', null).ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    )
    expect(findActive).not.toHaveBeenCalled()
  })

  it('refuses a request with no tenant header rather than guessing one', async () => {
    // A user may belong to several agencies. Picking one for them would be an
    // authorization decision made by the absence of information.
    await expect(guard.canActivate(makeContext(undefined).ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
    expect(findActive).not.toHaveBeenCalled()
  })

  it('refuses a tenant the user has no membership in', async () => {
    // The header is client-supplied: this is what stops one agency reading
    // another's data by sending a different id.
    findActive.mockResolvedValue(null)

    await expect(guard.canActivate(makeContext('someone-elses-tenant').ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
    expect(findActive).toHaveBeenCalledWith('user-1', 'someone-elses-tenant')
  })

  it('refuses a deactivated user who still holds a membership row', async () => {
    findActive.mockResolvedValue(membership({ user: { status: 'SUSPENDED' } }))

    await expect(guard.canActivate(makeContext('tenant-1').ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    )
  })

  it('never publishes a context or a tenant id when it refuses', async () => {
    findActive.mockResolvedValue(membership({ tenant: { id: 't', slug: 's', status: 'SUSPENDED' } }))
    const { ctx, request } = makeContext('t')

    await guard.canActivate(ctx).catch(() => undefined)

    expect(request.tenantContext).toBeUndefined()
    expect(store.setTenantId).not.toHaveBeenCalled()
  })
})
