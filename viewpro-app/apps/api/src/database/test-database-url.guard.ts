const TEST_DATABASE_NAME_PATTERN = /(test|testing|ci)/i;
const DANGEROUS_DATABASE_NAMES = new Set([
	"viewpro",
	"postgres",
	"production",
	"prod",
]);

export function isTestRuntime(env: NodeJS.ProcessEnv = process.env) {
	return (
		env.VIEWPRO_TEST_RUN === "true" ||
		env.VITEST === "true" ||
		env.NODE_ENV === "test"
	);
}

export function assertSafeTestDatabaseUrl(
	databaseUrl = process.env.DATABASE_URL,
) {
	if (!isTestRuntime()) {
		return;
	}

	if (!databaseUrl) {
		throw new Error(
			"Refusing to run API tests without DATABASE_URL. Use a dedicated test database, e.g. viewpro_test.",
		);
	}

	let parsedUrl: URL;
	try {
		parsedUrl = new URL(databaseUrl);
	} catch (error) {
		throw new Error("Refusing to run API tests with an invalid DATABASE_URL.", {
			cause: error,
		});
	}

	const databaseName = parsedUrl.pathname.replace(/^\//, "");
	const schemaName = parsedUrl.searchParams.get("schema") ?? "";
	const isClearlyTestScoped =
		TEST_DATABASE_NAME_PATTERN.test(databaseName) ||
		TEST_DATABASE_NAME_PATTERN.test(schemaName);

	if (DANGEROUS_DATABASE_NAMES.has(databaseName) || !isClearlyTestScoped) {
		throw new Error(
			[
				"Refusing to run API tests against a non-test database.",
				`DATABASE_URL database: ${databaseName || "<missing>"}`,
				`DATABASE_URL schema: ${schemaName || "<default>"}`,
				"Use a dedicated database such as postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public.",
			].join(" "),
		);
	}
}
