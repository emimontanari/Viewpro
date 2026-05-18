import { plainToInstance, Transform, Type } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min, validateSync } from 'class-validator'

class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development'

  @IsInt()
  @Min(1)
  @Max(65535)
  @Type(() => Number)
  PORT = 3001

  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string

  @IsInt()
  @Min(1)
  @Type(() => Number)
  AUTH_RATE_LIMIT_LOGIN_LIMIT = 5

  @IsInt()
  @Min(1)
  @Type(() => Number)
  AUTH_RATE_LIMIT_LOGIN_TTL_SECONDS = 60

  @IsInt()
  @Min(1)
  @Type(() => Number)
  AUTH_RATE_LIMIT_REGISTER_LIMIT = 3

  @IsInt()
  @Min(1)
  @Type(() => Number)
  AUTH_RATE_LIMIT_REGISTER_TTL_SECONDS = 60

  @IsInt()
  @Min(1)
  @Type(() => Number)
  AUTH_RATE_LIMIT_REFRESH_LIMIT = 20

  @IsInt()
  @Min(1)
  @Type(() => Number)
  AUTH_RATE_LIMIT_REFRESH_TTL_SECONDS = 60

  @IsOptional()
  @IsString()
  DATABASE_URL?: string

  @IsString()
  ACCESS_TOKEN_SECRET = 'change-me-in-real-env'

  @IsOptional()
  @IsString()
  COOKIE_DOMAIN?: string

  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  COOKIE_SECURE = false

  @IsInt()
  @Min(60)
  @Type(() => Number)
  ACCESS_TOKEN_TTL_SECONDS = 900

  @IsInt()
  @Min(3600)
  @Type(() => Number)
  REFRESH_TOKEN_TTL_SECONDS = 2592000
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  })

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  })

  if (errors.length > 0) {
    throw new Error(errors.toString())
  }

  return validatedConfig
}
