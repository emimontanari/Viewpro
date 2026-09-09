import { IsUUID } from 'class-validator'

export class PropertyProposalIdParams {
  @IsUUID()
  proposalId!: string
}
