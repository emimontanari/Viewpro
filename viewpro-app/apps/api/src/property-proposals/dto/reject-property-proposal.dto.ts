import { Allow, IsUUID } from 'class-validator'

export class RejectPropertyProposalDto {
  @IsUUID()
  reviewRoundId!: string

  @Allow()
  reason?: unknown
}
