import { describe, expect, it } from 'vitest'
import { PLATFORM_PERMISSIONS } from '../platform-permissions.constants'
import { getPermissionsForRole } from '../role-permissions'

/**
 * platform-payment-ledger (PR 2) — RED: separation of duties over money.
 *
 * The asymmetry here is the point, and it is easy to "tidy up" later into
 * something wrong. ANALYST deliberately KEEPS read access to the ledger:
 * fraud detection depends on the people who cannot write money being able to
 * see it. Taking that away to look tidy would remove the only independent
 * reviewer. And reversal is OWNER-only, because reversal is the one operation
 * that makes a recorded payment stop counting — the exact lever someone
 * covering a fraudulent entry would reach for.
 *
 * Spec: Permission Separation for Money Operations.
 */
describe('payment permissions — separation of duties', () => {
  it('ANALYST can read the ledger but can neither record nor reverse', () => {
    const permissions = getPermissionsForRole('ANALYST')

    expect(permissions).toContain(PLATFORM_PERMISSIONS.PAYMENTS_READ)
    expect(permissions).not.toContain(PLATFORM_PERMISSIONS.PAYMENTS_WRITE)
    expect(permissions).not.toContain(PLATFORM_PERMISSIONS.PAYMENTS_REVERSE)
  })

  it('OPERATIONS can read and record but cannot reverse', () => {
    const permissions = getPermissionsForRole('OPERATIONS')

    expect(permissions).toContain(PLATFORM_PERMISSIONS.PAYMENTS_READ)
    expect(permissions).toContain(PLATFORM_PERMISSIONS.PAYMENTS_WRITE)
    expect(permissions).not.toContain(PLATFORM_PERMISSIONS.PAYMENTS_REVERSE)
  })

  it('OWNER holds all three, reversal included', () => {
    const permissions = getPermissionsForRole('OWNER')

    expect(permissions).toContain(PLATFORM_PERMISSIONS.PAYMENTS_READ)
    expect(permissions).toContain(PLATFORM_PERMISSIONS.PAYMENTS_WRITE)
    expect(permissions).toContain(PLATFORM_PERMISSIONS.PAYMENTS_REVERSE)
  })

  it('reversal is held by exactly one role', () => {
    const rolesWithReversal = (['ANALYST', 'OPERATIONS', 'OWNER'] as const).filter((role) =>
      getPermissionsForRole(role).includes(PLATFORM_PERMISSIONS.PAYMENTS_REVERSE),
    )

    expect(rolesWithReversal).toEqual(['OWNER'])
  })

  it('every role that can write money can also read it', () => {
    // A writer who cannot read their own ledger cannot verify what they wrote.
    const writers = (['ANALYST', 'OPERATIONS', 'OWNER'] as const).filter((role) =>
      getPermissionsForRole(role).includes(PLATFORM_PERMISSIONS.PAYMENTS_WRITE),
    )
    const writersWithoutRead = writers.filter(
      (role) => !getPermissionsForRole(role).includes(PLATFORM_PERMISSIONS.PAYMENTS_READ),
    )

    // Pinning the premise too: with no writers at all the invariant below is
    // vacuously true, which is how this test used to pass while proving nothing.
    expect(writers).toEqual(['OPERATIONS', 'OWNER'])
    expect(writersWithoutRead).toEqual([])
  })
})
