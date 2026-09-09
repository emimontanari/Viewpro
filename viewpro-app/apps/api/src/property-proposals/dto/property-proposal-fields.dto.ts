import { PropertyOperationType, PropertyType } from '@prisma/client'
import { IsDefined, IsEmail, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'

export class PropertyProposalFieldsDto {
  @IsDefined()
  @IsString()
  @MaxLength(120)
  title?: string

  @IsOptional()
  @IsString()
  @MaxLength(180)
  addressLine?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(80)
  province?: string | null

  @IsOptional()
  @IsEnum(PropertyType)
  propertyType?: PropertyType | null

  @IsOptional()
  @IsEnum(PropertyOperationType)
  operationType?: PropertyOperationType | null

  @IsOptional()
  @IsInt()
  @Min(0)
  totalAreaSqm?: number | null

  @IsOptional()
  @IsInt()
  @Min(0)
  coveredAreaSqm?: number | null

  @IsOptional()
  @IsInt()
  @Min(0)
  rooms?: number | null

  @IsOptional()
  @IsInt()
  @Min(0)
  bedrooms?: number | null

  @IsOptional()
  @IsInt()
  @Min(0)
  bathrooms?: number | null

  @IsOptional()
  @IsInt()
  @Min(0)
  garages?: number | null

  @IsOptional()
  @IsInt()
  @Min(0)
  ageYears?: number | null

  @IsOptional()
  @IsString()
  @MaxLength(16)
  orientation?: string | null

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ownerName?: string | null

  @IsOptional()
  @IsEmail()
  ownerEmail?: string | null

  @IsOptional()
  @IsInt()
  @Min(0)
  publishedPriceCents?: number | null

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string | null
}
