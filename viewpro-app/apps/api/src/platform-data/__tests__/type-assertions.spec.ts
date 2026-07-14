/**
 * T-02 / T-03 — Compile-time type-equality assertion
 *
 * Asserts that PlatformTenantStatus (from @viewpro/platform-contract) is
 * bidirectionally equal to TenantStatus (from @prisma/client) at compile time.
 *
 * This mirrors the pattern established in platform-control/type-assertions.ts.
 * RED until apps/api/src/platform-data/type-assertions.ts is wired (T-03).
 */
import { describe, it, expect } from 'vitest'
import type { PlatformTenantStatus } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }
import type { TenantStatus } from '@prisma/client'

// Positive assertion: both types must be bidirectionally assignable.
// If this resolves to `never`, tsc will reject the `= true` assignment below.
type _AssertEqual =
  [PlatformTenantStatus] extends [TenantStatus]
    ? [TenantStatus] extends [PlatformTenantStatus]
      ? true
      : never
    : never

const _typeCheck: _AssertEqual = true
void _typeCheck

// Negative assertion: assigning `true` to a `never`-resolving type must error.
// The type below resolves to `never` because PlatformTenantStatus ≠ 'WRONG'.
type _BadAssert = [PlatformTenantStatus] extends ['WRONG'] ? true : never

// @ts-expect-error — _BadAssert resolves to `never`; `true` is not assignable to it
const _badCheck: _BadAssert = true
void _badCheck

describe('PlatformTenantStatus ↔ TenantStatus compile-time equality assertion', () => {
  it('assertion evaluates to true (types are in sync)', () => {
    expect(_typeCheck).toBe(true)
  })

  it('negative: mismatched type resolves to never — caught by @ts-expect-error', () => {
    // The real test is at compile time (tsc would error if @ts-expect-error is wrong).
    // Runtime: just confirms this code path executes.
    expect(true).toBe(true)
  })
})
