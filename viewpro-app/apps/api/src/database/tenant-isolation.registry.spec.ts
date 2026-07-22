import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TENANT_OWNED_MODELS } from "./tenant-isolation.extension";

/**
 * Anti-regression guardrail for the isolation backstop.
 *
 * The extension only enforces tenant scope for models listed in
 * TENANT_OWNED_MODELS. If someone adds a `tenantId` column to a new (or
 * existing) model but forgets to register it here, that table would silently
 * escape enforcement — a latent cross-tenant leak. This test fails the build in
 * that case by deriving the class-A set straight from schema.prisma and
 * comparing it to the registry.
 */
describe("tenant isolation registry vs schema", () => {
	it("TENANT_OWNED_MODELS matches every model with a direct tenantId column", () => {
		// The api test suite runs with apps/api as the working directory.
		const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");

		const modelsWithTenantId = new Set<string>();
		for (const match of schema.matchAll(/model\s+(\w+)\s*\{([^}]*)\}/g)) {
			const name = match[1];
			const body = match[2];
			if (!name || !body) {
				continue;
			}

			// A real field declaration `tenantId String` / `tenantId String?`,
			// not a relation (`tenant Tenant ...`) or an index (`@@index([tenantId])`).
			if (/^\s*tenantId\s+String/m.test(body)) {
				modelsWithTenantId.add(name);
			}
		}

		expect([...modelsWithTenantId].sort()).toEqual([...TENANT_OWNED_MODELS].sort());
	});
});
