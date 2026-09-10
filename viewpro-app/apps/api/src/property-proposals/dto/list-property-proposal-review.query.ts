import { PropertyProposalStatus } from '@prisma/client'
import { Transform } from 'class-transformer'
import { IsEnum, IsIn, IsInt, Max, Min, ValidateIf } from 'class-validator'

export class ListPropertyProposalReviewQuery {
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(PropertyProposalStatus)
  state?: PropertyProposalStatus

  @ValidateIf((_, value) => value !== undefined)
  @IsIn(['NONE', 'PENDING', 'APPROVED', 'REJECTED'])
  history?: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED'

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
