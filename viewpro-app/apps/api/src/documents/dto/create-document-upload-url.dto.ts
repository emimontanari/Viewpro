import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator'
import { MAX_DOCUMENT_UPLOAD_SIZE_BYTES } from '../document-upload-constraints'

export { MAX_DOCUMENT_UPLOAD_SIZE_BYTES } from '../document-upload-constraints'

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
