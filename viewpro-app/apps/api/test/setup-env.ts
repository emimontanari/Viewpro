import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertSafeTestDatabaseUrl } from "../src/database/test-database-url.guard";
import { currentPoolId, workerDatabaseUrl } from "./worker-databases";

process.env.VIEWPRO_TEST_RUN = "true";
process.env.NODE_ENV = "test";

loadEnvFile(resolve(process.cwd(), ".env.test"));

// Each worker gets its own database, prepared by test/global-setup.ts. Suites
// clean up with unfiltered deleteMany(), so they must not share one.
const poolId = currentPoolId();
process.env.DATABASE_URL = workerDatabaseUrl(poolId);
// No separate pooler in dev/test — migrations use the same connection.
process.env.DIRECT_URL = process.env.DATABASE_URL;
process.env.ACCESS_TOKEN_SECRET ??= "test-access-token-secret";
process.env.PLATFORM_CONTROL_SECRET ??= "test-platform-control-secret-min16";
process.env.COOKIE_DOMAIN ??= "localhost";
process.env.COOKIE_SECURE ??= "false";
process.env.CORS_ORIGIN ??= "http://localhost:3000";
process.env.API_PUBLIC_URL ??= "http://localhost:3001";
// Per worker as well: parallel files would otherwise write into one directory.
process.env.PROPERTY_IMAGES_UPLOADS_ROOT ??= resolve(
	process.cwd(),
	`uploads-test-w${poolId}`,
);
process.env.SENTRY_TRACES_SAMPLE_RATE ??= "0";

assertSafeTestDatabaseUrl();

function loadEnvFile(filePath: string) {
	if (!existsSync(filePath)) {
		return;
	}

	const file = readFileSync(filePath, "utf8");

	for (const line of file.split(/\r?\n/)) {
		const trimmedLine = line.trim();

		if (!trimmedLine || trimmedLine.startsWith("#")) {
			continue;
		}

		const separatorIndex = trimmedLine.indexOf("=");
		if (separatorIndex === -1) {
			continue;
		}

		const key = trimmedLine.slice(0, separatorIndex).trim();
		const value = unquoteEnvValue(trimmedLine.slice(separatorIndex + 1).trim());

		if (key && process.env[key] === undefined) {
			process.env[key] = value;
		}
	}
}

function unquoteEnvValue(value: string) {
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1);
	}

	return value;
}
