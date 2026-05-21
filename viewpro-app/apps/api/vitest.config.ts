import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		// E2E specs share the local Postgres test database and clean tables between cases.
		// Keep files serial until the suite has per-worker database isolation.
		fileParallelism: false,
		include: ["test/**/*.spec.ts", "test/**/*.e2e-spec.ts"],
		setupFiles: ["./test/setup-env.ts"],
	},
});
