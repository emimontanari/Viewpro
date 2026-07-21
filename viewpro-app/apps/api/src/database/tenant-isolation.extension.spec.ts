import { describe, expect, it } from "vitest";
import { hasTenantIdInArgs } from "./tenant-isolation.extension";

describe("hasTenantIdInArgs", () => {
	it("detects a tenantId filter in where", () => {
		expect(hasTenantIdInArgs({ where: { tenantId: "t-1" } })).toBe(true);
	});

	it("detects tenantId in create/update data", () => {
		expect(hasTenantIdInArgs({ data: { tenantId: "t-1", name: "x" } })).toBe(true);
	});

	it("returns false when neither where nor data carry tenantId", () => {
		expect(hasTenantIdInArgs({ where: { id: "row-1" } })).toBe(false);
		expect(hasTenantIdInArgs({ data: { name: "x" } })).toBe(false);
	});

	it("returns false for missing or non-object args", () => {
		expect(hasTenantIdInArgs(undefined)).toBe(false);
		expect(hasTenantIdInArgs(null)).toBe(false);
		expect(hasTenantIdInArgs("nope")).toBe(false);
		expect(hasTenantIdInArgs({})).toBe(false);
	});
});
