import { FeedbackType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { renderFeedbackEmail } from "../feedback-email.template";

const input = {
	type: FeedbackType.ERROR,
	description: '<script>hostile & "text"</script>',
	pathname: "/dashboard",
	createdAt: new Date("2026-08-31T10:00:00.000Z"),
	reportId: "report-1",
	userId: "user-1",
	tenantId: "tenant-1",
	requestId: "01234567-89ab-4def-8abc-0123456789ab",
	userEmail: "member@example.com",
	tenantName: "Tenant <One>",
};

describe("renderFeedbackEmail", () => {
	it("renders only approved fields and escapes HTML while keeping text literal", () => {
		const email = renderFeedbackEmail(input);
		expect(email.html).toContain("&lt;script&gt;hostile &amp; &quot;text&quot;&lt;/script&gt;");
		expect(email.html).toContain("Tenant &lt;One&gt;");
		expect(email.text).toContain(input.description);
		expect(email.text).toContain(input.userEmail);
	});

	it("omits optional pathname and request ID rather than inventing values", () => {
		const email = renderFeedbackEmail({ ...input, pathname: undefined, requestId: undefined });
		expect(email.text).not.toContain("Pathname:");
		expect(email.text).not.toContain("Request ID:");
	});
});
