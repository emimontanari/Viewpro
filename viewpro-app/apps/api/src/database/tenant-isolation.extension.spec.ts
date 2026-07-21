import { describe, expect, it } from "vitest";
import { hasTenantIdInArgs, injectTenantId } from "./tenant-isolation.extension";

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

describe("injectTenantId", () => {
	it("adds a where.tenantId to empty or undefined args", () => {
		expect(injectTenantId(undefined, "t-1")).toEqual({ where: { tenantId: "t-1" } });
		expect(injectTenantId({}, "t-1")).toEqual({ where: { tenantId: "t-1" } });
	});

	it("merges tenantId with an existing where without dropping conditions", () => {
		expect(injectTenantId({ where: { status: "ACTIVE" } }, "t-1")).toEqual({
			where: { status: "ACTIVE", tenantId: "t-1" },
		});
	});

	it("preserves other top-level args (select, orderBy, take)", () => {
		const result = injectTenantId({ take: 10, select: { id: true } }, "t-1");
		expect(result).toEqual({ take: 10, select: { id: true }, where: { tenantId: "t-1" } });
	});

	it("respects an explicit tenantId already in where (never overwrites)", () => {
		const args = { where: { tenantId: "explicit" } };
		expect(injectTenantId(args, "t-1")).toBe(args);
	});
});
