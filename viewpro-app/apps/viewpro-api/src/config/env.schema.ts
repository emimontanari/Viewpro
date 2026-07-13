import { plainToInstance, Transform, Type } from 'class-transformer'
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator'

class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development'

  @IsInt()
  @Min(1)
  @Max(65535)
  @Type(() => Number)
  PORT = 3002

  @IsOptional()
  @IsString()
  DATABASE_URL?: string

  // Required — no default. A missing/weak secret means forgeable operator tokens.
  @IsString()
  @MinLength(16)
  ACCESS_TOKEN_SECRET!: string

  @IsInt()
  @Min(60)
  @Type(() => Number)
  ACCESS_TOKEN_TTL_SECONDS = 900

  @IsOptional()
  @IsString()
  COOKIE_DOMAIN?: string

  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  COOKIE_SECURE = false

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
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  })

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  })

  if (errors.length > 0) {
    throw new Error(formatValidationErrors(errors))
  }

  return validatedConfig
}

function formatValidationErrors(
  errors: Array<{ property: string; constraints?: Record<string, string> }>,
) {
  return errors
    .map((error) => {
      const constraints = Object.values(error.constraints ?? {}).join(', ')
      return constraints ? `${error.property}: ${constraints}` : error.property
    })
    .join('; ')
}
