import { IsInt, IsString, MaxLength, Min, ValidateIf } from 'class-validator'
import { PropertyProposalFieldsDto } from './property-proposal-fields.dto'

export class UpdatePropertyProposalDto extends PropertyProposalFieldsDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(120)
  declare title?: string

  @IsInt()
  @Min(1)
  expectedVersion!: number
}
