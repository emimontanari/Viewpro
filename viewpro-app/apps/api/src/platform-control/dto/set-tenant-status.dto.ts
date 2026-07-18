import { IsEnum, IsString } from 'class-validator'
import { TenantStatus } from '@prisma/client'

/**
 * DTO for POST /internal/platform/tenants/:id/status
 * Maps to SetTenantStatusCommand from @viewpro/platform-contract.
 */
export class SetTenantStatusDto {
  @IsEnum(TenantStatus)
  targetStatus!: TenantStatus

  @IsString()
  idempotencyKey!: string
}
