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
	MinLength,
	validateSync,
} from "class-validator";

// Dev/test default so local runs and the suite work without extra setup.
// Production must NEVER boot with this value — enforced by assertProductionSecurity.
const ACCESS_TOKEN_SECRET_DEV_PLACEHOLDER = "change-me-in-real-env";

// Minimum length required for the session-signing secret in production.
const ACCESS_TOKEN_SECRET_MIN_LENGTH = 32;

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

	// Signs user session tokens. A weak/known value lets anyone forge a token for
	// any user of any tenant. Keeps a dev default, but assertProductionSecurity
	// rejects the placeholder and anything under 32 chars when NODE_ENV=production.
	@IsString()
	ACCESS_TOKEN_SECRET = ACCESS_TOKEN_SECRET_DEV_PLACEHOLDER;

	@IsOptional()
	@IsString()
	COOKIE_DOMAIN?: string;

	// Dev default false for http://localhost. assertProductionSecurity requires
	// true in production so session cookies are never sent over plain HTTP.
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

	// Required — no default. Shared with viewpro-api; a weak/missing secret would
	// let a forged service token drive tenant control commands. Fail fast at boot.
	@IsString()
	@MinLength(16)
	PLATFORM_CONTROL_SECRET!: string;

	// Optional — configurable batch size for GET /internal/platform/changes.
	// Controller reads process.env.PLATFORM_DATA_BATCH_LIMIT directly at request
	// time so test overrides take effect without restarting the app.
	@IsOptional()
	@IsInt()
	@Min(1)
	@Type(() => Number)
	PLATFORM_DATA_BATCH_LIMIT = 100;
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

	assertProductionSecurity(validatedConfig);

	return validatedConfig;
}

// Cross-field security guards that only apply in production. Per-field decorators
// keep dev/test permissive; these fail the boot when a real deployment is
// misconfigured, mirroring the fail-fast contract of PLATFORM_CONTROL_SECRET.
function assertProductionSecurity(config: EnvironmentVariables) {
	if (config.NODE_ENV !== "production") {
		return;
	}

	const violations: string[] = [];

	if (
		config.ACCESS_TOKEN_SECRET === ACCESS_TOKEN_SECRET_DEV_PLACEHOLDER ||
		config.ACCESS_TOKEN_SECRET.length < ACCESS_TOKEN_SECRET_MIN_LENGTH
	) {
		violations.push(
			`ACCESS_TOKEN_SECRET: must be a strong secret of at least ${ACCESS_TOKEN_SECRET_MIN_LENGTH} characters in production (never the placeholder)`,
		);
	}

	if (config.COOKIE_SECURE !== true) {
		violations.push(
			"COOKIE_SECURE: must be true in production so session cookies require HTTPS",
		);
	}

	if (config.DOCUMENT_STORAGE_DRIVER !== "s3") {
		violations.push(
			"DOCUMENT_STORAGE_DRIVER: must be 's3' in production (local/fake storage is not allowed)",
		);
	}

	if (violations.length > 0) {
		throw new Error(violations.join("; "));
	}
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
