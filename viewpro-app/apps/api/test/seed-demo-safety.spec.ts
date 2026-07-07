import { describe, expect, it } from "vitest";
import {
	assertSafeDemoSeedEnvironment,
	looksLocalDevOrTestDatabase,
} from "../scripts/seed-demo-safety.mjs";

describe("seed demo safety guard", () => {
	it("allows local development database URLs without demo reset flags", () => {
		expect(
			assertSafeDemoSeedEnvironment({
				DATABASE_URL:
					"postgresql://postgres:postgres@localhost:5432/viewpro_dev",
			}),
		).toEqual({ mode: "local" });
	});

	it("blocks production node env unless explicit guarded demo reset is configured", () => {
		expect(() =>
			assertSafeDemoSeedEnvironment({
				NODE_ENV: "production",
				DATABASE_URL: "postgresql://user:pass@db.example.com/viewpro_demo",
			}),
		).toThrow("NODE_ENV=production outside guarded demo reset mode");
	});

	it("requires both demo environment and allow flag for guarded demo reset", () => {
		expect(() =>
			assertSafeDemoSeedEnvironment({
				DATABASE_URL: "postgresql://user:pass@db.example.com/inmoview_demo",
				INMOVIEW_DEMO_SEED_ALLOWED: "true",
				INMOVIEW_DEMO_DATABASE_IDENTIFIER: "inmoview_demo",
			}),
		).toThrow("INMOVIEW_ENVIRONMENT=demo");

		expect(() =>
			assertSafeDemoSeedEnvironment({
				DATABASE_URL: "postgresql://user:pass@db.example.com/inmoview_demo",
				INMOVIEW_ENVIRONMENT: "demo",
				INMOVIEW_DEMO_DATABASE_IDENTIFIER: "inmoview_demo",
			}),
		).toThrow("INMOVIEW_DEMO_SEED_ALLOWED=true");
	});

	it("requires a strong demo database identifier contained in DATABASE_URL", () => {
		expect(() =>
			assertSafeDemoSeedEnvironment({
				DATABASE_URL: "postgresql://user:pass@db.example.com/inmoview_demo",
				INMOVIEW_ENVIRONMENT: "demo",
				INMOVIEW_DEMO_SEED_ALLOWED: "true",
				INMOVIEW_DEMO_DATABASE_IDENTIFIER: "db",
			}),
		).toThrow("at least 4 characters");

		expect(() =>
			assertSafeDemoSeedEnvironment({
				DATABASE_URL: "postgresql://user:pass@db.example.com/production",
				INMOVIEW_ENVIRONMENT: "demo",
				INMOVIEW_DEMO_SEED_ALLOWED: "true",
				INMOVIEW_DEMO_DATABASE_IDENTIFIER: "inmoview_demo",
			}),
		).toThrow(
			"DATABASE_URL does not contain INMOVIEW_DEMO_DATABASE_IDENTIFIER",
		);
	});

	it("allows guarded demo reset when all explicit safety signals match", () => {
		expect(
			assertSafeDemoSeedEnvironment({
				NODE_ENV: "production",
				DATABASE_URL:
					"postgresql://user:pass@railway.internal:5432/inmoview_demo",
				INMOVIEW_ENVIRONMENT: "demo",
				INMOVIEW_DEMO_SEED_ALLOWED: "true",
				INMOVIEW_DEMO_DATABASE_IDENTIFIER: "inmoview_demo",
			}),
		).toEqual({ mode: "demo" });
	});

	it("detects local/dev/test database URLs", () => {
		expect(
			looksLocalDevOrTestDatabase(
				"postgresql://postgres:postgres@127.0.0.1:5432/viewpro_test",
			),
		).toBe(true);
		expect(
			looksLocalDevOrTestDatabase(
				"postgresql://user:pass@db.example.com/viewpro_prod",
			),
		).toBe(false);
	});
});
