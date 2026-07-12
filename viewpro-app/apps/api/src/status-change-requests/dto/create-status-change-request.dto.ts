import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'
import { PropertyEngagementStatus } from '@prisma/client'

export class CreateStatusChangeRequestDto {
  /**
   * The desired target status (FR-1, FR-23). Returns 400 if not a valid enum value.
   */
  @IsEnum(PropertyEngagementStatus)
  targetStatus!: PropertyEngagementStatus

  /**
   * The property status the seller sees at submission time (FR-2).
   * Used by the stale-state guard at approval time (FR-14, FR-19).
   * Returns 400 if not a valid enum value.
   */
  @IsEnum(PropertyEngagementStatus)
  currentStatusSnapshot!: PropertyEngagementStatus

  /**
   * Optional note from the seller (max 1000 chars, FR-1).
   */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  requestNote?: string
}
