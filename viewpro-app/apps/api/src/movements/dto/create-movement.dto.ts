import {
  InterestLevel,
  MovementBuiltInOutcome,
  MovementType,
  PropertyEngagementStatus,
} from '@prisma/client'
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNotIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
  registerDecorator,
} from 'class-validator'
import type { ValidationOptions, ValidationArguments } from 'class-validator'

// Outcome discriminated union: either builtIn or customLabelId, never both
export class BuiltInOutcomeDto {
  @IsEnum(MovementBuiltInOutcome)
  builtIn!: MovementBuiltInOutcome
}

export class CustomLabelOutcomeDto {
  @IsUUID()
  customLabelId!: string
}

// Custom class-level validator: outcome and newStatus are mutually exclusive (FR-30)
// and within outcome, only one of builtIn/customLabelId may be set.
function IsMutuallyExclusiveOutcome(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isMutuallyExclusiveOutcome',
      target: (object as { constructor: Function }).constructor,
      propertyName,
      options: {
        message: 'OUTCOME_BOTH_PROVIDED: outcome and newStatus are mutually exclusive, and within outcome only one of builtIn or customLabelId may be set',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const dto = args.object as CreateMovementDto
          // If newStatus and outcome are both set → invalid (FR-30)
          if (dto.newStatus !== undefined && dto.outcome !== undefined) {
            return false
          }
          // If outcome has both builtIn and customLabelId → invalid
          if (dto.outcome && 'builtIn' in dto.outcome && 'customLabelId' in dto.outcome) {
            return false
          }
          return true
        },
      },
    })
  }
}

export type MovementOutcome = { builtIn: MovementBuiltInOutcome } | { customLabelId: string }

export class CreateMovementDto {
  @IsEnum(MovementType)
  @IsNotIn([MovementType.ARCHIVED, MovementType.RESTORED], {
    message: 'Lifecycle movements must be created through property lifecycle actions',
  })
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

  /**
   * Optional outcome: either a built-in enum value or a reference to a custom tenant label.
   * Mutually exclusive with `newStatus` (FR-30 / OUTCOME_BOTH_PROVIDED).
   * Within the outcome object, only one of `builtIn` or `customLabelId` may be set.
   */
  @IsOptional()
  @IsMutuallyExclusiveOutcome()
  @ValidateIf((dto: CreateMovementDto) => dto.outcome !== undefined || dto.newStatus !== undefined)
  outcome?: MovementOutcome
}
