import { Transform } from 'class-transformer'
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator'

export class ListAdminActivityQuery {
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
  @IsUUID()
  tenantId?: string
}
