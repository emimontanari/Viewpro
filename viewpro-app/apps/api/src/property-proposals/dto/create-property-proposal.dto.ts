import { PropertyProposalFieldsDto } from './property-proposal-fields.dto'

export class CreatePropertyProposalDto extends PropertyProposalFieldsDto {
  declare title: string
}
