import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator'

export class RegisterTenantDto {
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(8)
  password!: string

  @IsString()
  @MinLength(1)
  firstName!: string

  @IsOptional()
  @IsString()
  lastName?: string

  @IsString()
  @MinLength(1)
  tenantName!: string
}
