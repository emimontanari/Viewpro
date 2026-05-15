import { InterestLevel, MovementType, PropertyEngagementStatus } from '@prisma/client'
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator'

export class CreateMovementDto {
  @IsEnum(MovementType)
  type!: MovementType

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  observation!: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  nextStep?: string

  @IsOptional()
  @IsEnum(PropertyEngagementStatus)
  newStatus?: PropertyEngagementStatus

  @IsOptional()
  @IsInt()
  @Min(0)
  interestCount?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  visitCount?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  offerAmountCents?: number

  @IsOptional()
  @IsEnum(InterestLevel)
  interestLevel?: InterestLevel
}
