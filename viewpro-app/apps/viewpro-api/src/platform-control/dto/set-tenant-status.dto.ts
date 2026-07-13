import { IsIn } from 'class-validator'
import type { PlatformTenantStatus } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }

/**
 * DTO for PATCH /operators/tenants/:id/status
 */
export class SetTenantStatusDto {
  @IsIn(['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED'])
  status!: PlatformTenantStatus
}
