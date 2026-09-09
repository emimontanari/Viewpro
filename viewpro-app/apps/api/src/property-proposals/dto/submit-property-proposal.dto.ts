import { IsInt, Min } from 'class-validator'

export class SubmitPropertyProposalDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number
}
