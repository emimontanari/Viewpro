import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator'

export const MAX_DOCUMENT_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024

export class CreateDocumentUploadUrlDto {
  @IsString()
  @IsNotEmpty()
  originalFilename!: string

  @IsString()
  @IsNotEmpty()
  mimeType!: string

  @IsInt()
  @Min(1)
  @Max(MAX_DOCUMENT_UPLOAD_SIZE_BYTES)
  sizeBytes!: number

  @IsOptional()
  @IsString()
  checksum?: string
}
