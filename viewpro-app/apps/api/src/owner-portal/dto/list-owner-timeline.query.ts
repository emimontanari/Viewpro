import { Transform } from 'class-transformer'
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator'

export class ListOwnerTimelineQuery {
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
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc'
}
