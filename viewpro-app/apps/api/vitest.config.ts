import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		// E2E specs share the local Postgres test database and clean tables between cases.
		// Keep files serial until the suite has per-worker database isolation.
		fileParallelism: false,
		// Some specs assert on best-effort, fire-and-forget side effects (e.g. the
		// STATUS_CHANGE_APPROVED notification written after the request returns).
		// On slower CI runners the assertion can outrun that async write. Retry is a
		// stopgap — the real fix is polling for the side effect / per-worker DB
		// isolation. A retry cannot turn a deterministic failure green.
		retry: 2,
		include: ["src/**/*.spec.ts", "test/**/*.spec.ts", "test/**/*.e2e-spec.ts"],
		setupFiles: ["./test/setup-env.ts"],
	},
});
