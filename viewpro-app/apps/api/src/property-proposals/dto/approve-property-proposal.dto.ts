import { IsUUID } from 'class-validator'

export class ApprovePropertyProposalDto {
  @IsUUID()
  reviewRoundId!: string
}
