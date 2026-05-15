import { IsUUID } from 'class-validator'

export class AssignPropertyAgentDto {
  @IsUUID()
  agentUserId!: string
}
