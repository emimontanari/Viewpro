import { TenantStatus } from '@prisma/client'
import { Transform } from 'class-transformer'
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator'

export class ListAdminTenantsQuery {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20

  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus
}
