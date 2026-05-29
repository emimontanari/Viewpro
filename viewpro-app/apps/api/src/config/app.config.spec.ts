import { describe, expect, it } from "vitest";
import { getAppPublicUrl } from "./app.config";

describe("getAppPublicUrl", () => {
	it("defaults to the local app origin outside production", () => {
		expect(getAppPublicUrl(undefined, "development")).toBe(
			"http://localhost:3000",
		);
	});

	it("trims trailing slashes", () => {
		expect(getAppPublicUrl("https://app.viewpro.test/", "production")).toBe(
			"https://app.viewpro.test",
		);
	});

	it("requires an explicit app origin in production", () => {
		expect(() => getAppPublicUrl(undefined, "production")).toThrow(
			"APP_PUBLIC_URL",
		);
	});
});
