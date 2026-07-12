import { Transform } from 'class-transformer'
import { IsOptional, IsString, Length, Matches } from 'class-validator'

export class CreateLabelDto {
  /**
   * Label string. Trimmed before validation. Max 40 characters (FR-4, FR-7).
   * Must not collide case-insensitively with any MovementBuiltInOutcome value (checked in use case).
   */
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, 40)
  label!: string

  /**
   * Optional CSS hex color #RRGGBB (FR-4, FR-8, R3).
   * Returns HTTP 400 from the global ValidationPipe on format mismatch.
   */
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'LABEL_COLOR_INVALID: color must be a valid 6-digit hex color (#RRGGBB)',
  })
  color?: string
}
