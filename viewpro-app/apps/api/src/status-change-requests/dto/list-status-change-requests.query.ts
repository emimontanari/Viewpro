import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator'

export class ListStatusChangeRequestsQuery {
  /**
   * Filter by status. MVP only supports PENDING (R4 — manager bandeja).
   */
  @IsOptional()
  @IsIn(['PENDING'])
  status?: 'PENDING'

  /**
   * Hard cap of 200 records (R4). Defaults to 200 when omitted.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  take?: number
}
