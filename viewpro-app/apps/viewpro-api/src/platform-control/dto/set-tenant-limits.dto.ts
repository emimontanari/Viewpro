import { IsInt, IsOptional } from 'class-validator'
import type { PlatformTenantLimits } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }

/**
 * DTO for PATCH /operators/tenants/:id/limits
 */
export class SetTenantLimitsDto implements PlatformTenantLimits {
  @IsOptional()
  @IsInt()
  maxUsers!: number | null

  @IsOptional()
  @IsInt()
  maxActivePropertyEngagements!: number | null

  @IsOptional()
  @IsInt()
  maxDocumentsStorageMb!: number | null
}
