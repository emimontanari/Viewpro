import { describe, expect, it } from "vitest";
import { getAppPublicUrl, getFeedbackEmailConfig } from "./app.config";

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

	it("keeps the feedback recipient as one configured value", () => {
		expect(getFeedbackEmailConfig({ FEEDBACK_RECIPIENT_EMAIL: " recipient@example.com " })).toEqual({
			feedbackRecipient: "recipient@example.com",
		});
	});
});
