import { defineConfig } from "vitest/config";
import { TEST_WORKER_COUNT } from "./test/worker-databases";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		// Each worker owns a database prepared by test/global-setup.ts, so the
		// unfiltered deleteMany() cleanups can only reach their own worker's data.
		globalSetup: ["./test/global-setup.ts"],
		// One worker per prepared database, no more.
		maxWorkers: TEST_WORKER_COUNT,
		minWorkers: 1,
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
