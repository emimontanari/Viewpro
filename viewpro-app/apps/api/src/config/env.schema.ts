import { plainToInstance, Transform, Type } from "class-transformer";
import {
	IsBoolean,
	IsIn,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	Min,
	validateSync,
} from "class-validator";

class EnvironmentVariables {
	@IsIn(["development", "test", "production"])
	NODE_ENV: "development" | "test" | "production" = "development";

	@IsInt()
	@Min(1)
	@Max(65535)
	@Type(() => Number)
	PORT = 3001;

	@IsOptional()
	@IsString()
	CORS_ORIGIN?: string;

	@IsOptional()
	@IsString()
	APP_PUBLIC_URL?: string;

	@IsInt()
	@Min(1)
	@Type(() => Number)
	AUTH_RATE_LIMIT_LOGIN_LIMIT = 5;

	@IsInt()
	@Min(1)
	@Type(() => Number)
	AUTH_RATE_LIMIT_LOGIN_TTL_SECONDS = 60;

	@IsInt()
	@Min(1)
	@Type(() => Number)
	AUTH_RATE_LIMIT_REGISTER_LIMIT = 3;

	@IsInt()
	@Min(1)
	@Type(() => Number)
	AUTH_RATE_LIMIT_REGISTER_TTL_SECONDS = 60;

	@IsInt()
	@Min(1)
	@Type(() => Number)
	AUTH_RATE_LIMIT_REFRESH_LIMIT = 20;

	@IsInt()
	@Min(1)
	@Type(() => Number)
	AUTH_RATE_LIMIT_REFRESH_TTL_SECONDS = 60;

	@IsOptional()
	@IsString()
	DATABASE_URL?: string;

	@IsOptional()
	@IsIn(["fake", "local", "s3"])
	DOCUMENT_STORAGE_DRIVER?: "fake" | "local" | "s3";

	@IsOptional()
	@IsString()
	DOCUMENT_STORAGE_LOCAL_ROOT?: string;

	@IsOptional()
	@IsString()
	DOCUMENT_STORAGE_SIGNING_SECRET?: string;

	@IsOptional()
	@IsString()
	DOCUMENT_STORAGE_S3_BUCKET?: string;

	@IsOptional()
	@IsString()
	DOCUMENT_STORAGE_S3_ENDPOINT?: string;

	@IsOptional()
	@IsString()
	DOCUMENT_STORAGE_S3_REGION?: string;

	@IsOptional()
	@IsString()
	DOCUMENT_STORAGE_S3_ACCESS_KEY_ID?: string;

	@IsOptional()
	@IsString()
	DOCUMENT_STORAGE_S3_SECRET_ACCESS_KEY?: string;

	@IsOptional()
	@IsBoolean()
	@Transform(({ value }) => value === true || value === "true")
	DOCUMENT_STORAGE_S3_FORCE_PATH_STYLE = false;

	@IsString()
	ACCESS_TOKEN_SECRET = "change-me-in-real-env";

	@IsOptional()
	@IsString()
	COOKIE_DOMAIN?: string;

	@IsBoolean()
	@Transform(({ value }) => value === true || value === "true")
	COOKIE_SECURE = false;

	@IsInt()
	@Min(60)
	@Type(() => Number)
	ACCESS_TOKEN_TTL_SECONDS = 900;

	@IsInt()
	@Min(3600)
	@Type(() => Number)
	REFRESH_TOKEN_TTL_SECONDS = 2592000;

	@IsOptional()
	@IsString()
	RESEND_API_KEY?: string;

	@IsOptional()
	@IsString()
	EMAIL_FROM_ADDRESS?: string;

	@IsOptional()
	@IsString()
	SENTRY_DSN?: string;

	@IsOptional()
	@IsString()
	SENTRY_ENVIRONMENT?: string;

	@IsNumber()
	@Min(0)
	@Max(1)
	@Type(() => Number)
	SENTRY_TRACES_SAMPLE_RATE = 0;
}

export function validateEnv(config: Record<string, unknown>) {
	const validatedConfig = plainToInstance(EnvironmentVariables, config, {
		enableImplicitConversion: true,
	});

	const errors = validateSync(validatedConfig, {
		skipMissingProperties: false,
	});

	if (errors.length > 0) {
		throw new Error(formatValidationErrors(errors));
	}

	return validatedConfig;
}

function formatValidationErrors(
	errors: Array<{ property: string; constraints?: Record<string, string> }>,
) {
	return errors
		.map((error) => {
			const constraints = Object.values(error.constraints ?? {}).join(", ");
			return constraints ? `${error.property}: ${constraints}` : error.property;
		})
		.join("; ");
}
