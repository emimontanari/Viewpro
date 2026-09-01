import { ApiProperty } from '@nestjs/swagger'
import { IsDefined, IsUUID, ValidateIf } from 'class-validator'

export class SetPrimaryPropertyAgentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  agentId!: string

  @ApiProperty({ format: 'uuid', nullable: true })
  @IsDefined()
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  expectedPrimaryAgentId!: string | null
}
