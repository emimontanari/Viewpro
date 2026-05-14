import { plainToInstance } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Max, Min, validateSync } from 'class-validator'

class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development'

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3001

  @IsString()
  CORS_ORIGIN = 'http://localhost:3000'

  @IsOptional()
  @IsString()
  DATABASE_URL?: string
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
