import { Transform } from 'class-transformer'
import { IsBoolean, IsOptional } from 'class-validator'

export class ListLabelsQuery {
  /**
   * When true (default), only non-deleted labels are returned (FR-14).
   */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return value
  })
  activeOnly?: boolean = true
}
