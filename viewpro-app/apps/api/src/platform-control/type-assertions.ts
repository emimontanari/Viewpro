// resolution-mode="require" tells tsc to resolve @viewpro/platform-contract via the
// CJS "require" path even though the package declares "type":"module". Since the package
// entry point is a .ts source file (not a compiled .js), tsc can still read its types.
// This is a pure compile-time file; no runtime import is emitted.
import type { PlatformTenantStatus } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }
import type { TenantStatus } from '@prisma/client'

/**
 * Compile-time assertion that PlatformTenantStatus (from @viewpro/platform-contract)
 * is bidirectionally equal to TenantStatus (from @prisma/client).
 *
 * If this file compiles, the two types are identical and in sync.
 * If they drift, tsc will report a type error here before any code ships.
 */
type _AssertPlatformTenantStatusEqualsTenantStatus =
  [PlatformTenantStatus] extends [TenantStatus]
    ? [TenantStatus] extends [PlatformTenantStatus]
      ? true
      : never
    : never

// Forces evaluation; never executes at runtime (file is type-only).
const _typeCheck: _AssertPlatformTenantStatusEqualsTenantStatus = true
void _typeCheck
