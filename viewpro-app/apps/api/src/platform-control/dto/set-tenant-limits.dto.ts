import { IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

/**
 * Nested limits payload matching PlatformTenantLimits.
 * null values are allowed (same semantics as UpdateAdminTenantLimitsDto).
 */
export class TenantLimitsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  maxUsers?: number | null

  @IsOptional()
  @IsInt()
  @Min(0)
  maxActivePropertyEngagements?: number | null

  @IsOptional()
  @IsInt()
  @Min(0)
  maxDocumentsStorageMb?: number | null
}

/**
 * DTO for POST /internal/platform/tenants/:id/limits
 * Maps to SetTenantLimitsCommand from @viewpro/platform-contract.
 */
export class SetTenantLimitsDto {
  @ValidateNested()
  @Type(() => TenantLimitsDto)
  limits!: TenantLimitsDto

  @IsString()
  idempotencyKey!: string
}
