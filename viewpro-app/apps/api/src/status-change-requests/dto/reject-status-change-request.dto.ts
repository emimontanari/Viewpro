import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

export class RejectStatusChangeRequestDto {
  /**
   * Required manager resolution comment (FR-18). Returns 400 if missing or blank.
   * Error code: RESOLUTION_COMMENT_REQUIRED (returned via @IsNotEmpty message).
   */
  @IsString()
  @IsNotEmpty({ message: 'RESOLUTION_COMMENT_REQUIRED' })
  @MaxLength(1000)
  resolutionComment!: string
}
