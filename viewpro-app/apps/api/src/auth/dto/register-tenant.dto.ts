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

  // Mandatory agency contact phone (#287). Declared permissively — the
  // required/invalid/unsupported-country verdict is decided by the use
  // case via `parseArContactPhone`, never by `class-validator` decorators.
  // See design.md ADR-3: the global ValidationPipe has no exceptionFactory,
  // so a decorator-driven rejection here would carry no `errorCode`.
  @IsOptional()
  @IsString()
  whatsappPhone?: string
}
