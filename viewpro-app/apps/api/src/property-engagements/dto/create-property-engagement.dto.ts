import { PropertyOperationType, PropertyType } from '@prisma/client'
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'

export class CreatePropertyEngagementDto {
  @IsString()
  @MaxLength(120)
  title!: string

  @IsString()
  @MaxLength(180)
  addressLine!: string

  @IsString()
  @MaxLength(80)
  city!: string

  @IsString()
  @MaxLength(80)
  province!: string

  @IsEnum(PropertyType)
  propertyType!: PropertyType

  @IsOptional()
  @IsInt()
  @Min(0)
  totalAreaSqm?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  coveredAreaSqm?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  rooms?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  bedrooms?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  bathrooms?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  garages?: number

  @IsOptional()
  @IsInt()
  @Min(0)
  ageYears?: number

  @IsOptional()
  @IsString()
  @MaxLength(16)
  orientation?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ownerName?: string

  @IsOptional()
  @IsEmail()
  ownerEmail?: string

  @IsEnum(PropertyOperationType)
  operationType!: PropertyOperationType

  @IsOptional()
  @IsInt()
  @Min(0)
  publishedPriceCents?: number

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string
}
