import { SetMetadata } from '@nestjs/common'
import type { PlatformPermission } from './platform-permissions.constants'

export const REQUIRED_PLATFORM_PERMISSION_KEY = 'requiredPlatformPermission'

/**
 * Declares the single platform permission a route requires.
 * `PlatformPermissionGuard` denies by default when this metadata is absent
 * on a guarded route (D5 — secure-by-default).
 */
export const RequirePlatformPermission = (permission: PlatformPermission) =>
  SetMetadata(REQUIRED_PLATFORM_PERMISSION_KEY, permission)
