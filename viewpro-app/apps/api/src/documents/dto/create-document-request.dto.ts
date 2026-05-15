import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateDocumentRequestDto {
  @IsString()
  @IsNotEmpty()
  ownerUserId!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string
}
