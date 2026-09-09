import { Transform } from 'class-transformer'
import { IsInt, Max, Min } from 'class-validator'

export class ListPropertyProposalsQuery {
  @Transform(({ value }) => (value === undefined ? 1 : Number(value)))
  @IsInt()
  @Min(1)
  page = 1

  @Transform(({ value }) => (value === undefined ? 20 : Number(value)))
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20
}
