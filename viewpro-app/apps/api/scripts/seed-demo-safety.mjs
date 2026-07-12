const LOCAL_DATABASE_SIGNALS = [
	"localhost",
	"127.0.0.1",
	"viewpro_dev",
	"viewpro_test",
];

export function assertSafeDemoSeedEnvironment(env = process.env) {
	const databaseUrl = requireEnv(env, "DATABASE_URL");
	const demoResetRequested = isDemoResetRequested(env);

	if (demoResetRequested) {
		assertExplicitDemoResetEnvironment(env, databaseUrl);
		return { mode: "demo" };
	}

	if (env.NODE_ENV === "production") {
		throw new Error(
			"Refusing to run demo seed with NODE_ENV=production outside guarded demo reset mode.",
		);
	}

	if (!looksLocalDevOrTestDatabase(databaseUrl)) {
		throw new Error(
			"Refusing to run demo seed against a database URL that does not look local/dev/test. For the public demo reset, set INMOVIEW_ENVIRONMENT=demo, INMOVIEW_DEMO_SEED_ALLOWED=true, and INMOVIEW_DEMO_DATABASE_IDENTIFIER to a value contained in the dedicated demo DATABASE_URL.",
		);
	}

	return { mode: "local" };
}

export function looksLocalDevOrTestDatabase(databaseUrl) {
	const normalizedUrl = databaseUrl.toLowerCase();
	return LOCAL_DATABASE_SIGNALS.some((signal) =>
		normalizedUrl.includes(signal),
	);
}

function isDemoResetRequested(env) {
	return (
		env.INMOVIEW_ENVIRONMENT === "demo" ||
		env.INMOVIEW_DEMO_SEED_ALLOWED !== undefined ||
		env.INMOVIEW_DEMO_DATABASE_IDENTIFIER !== undefined
	);
}

function assertExplicitDemoResetEnvironment(env, databaseUrl) {
	if (env.INMOVIEW_ENVIRONMENT !== "demo") {
		throw new Error(
			"INMOVIEW_ENVIRONMENT=demo is required for guarded demo seed/reset.",
		);
	}

	if (env.INMOVIEW_DEMO_SEED_ALLOWED !== "true") {
		throw new Error(
			"INMOVIEW_DEMO_SEED_ALLOWED=true is required for guarded demo seed/reset.",
		);
	}

	const expectedIdentifier = requireEnv(
		env,
		"INMOVIEW_DEMO_DATABASE_IDENTIFIER",
	).toLowerCase();

	if (expectedIdentifier.length < 4) {
		throw new Error(
			"INMOVIEW_DEMO_DATABASE_IDENTIFIER must be at least 4 characters to avoid weak demo DB matching.",
		);
	}

	if (!databaseUrl.toLowerCase().includes(expectedIdentifier)) {
		throw new Error(
			"Refusing guarded demo seed/reset because DATABASE_URL does not contain INMOVIEW_DEMO_DATABASE_IDENTIFIER.",
		);
	}
}

function requireEnv(env, name) {
	const value = env[name];
	if (!value || !value.trim()) {
		throw new Error(`${name} is required to run the demo seed.`);
	}

	return value.trim();
}
