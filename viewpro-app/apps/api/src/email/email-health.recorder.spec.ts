import { describe, expect, it } from "vitest";
import { EmailHealthRecorder } from "./email-health.recorder";

const ADDRESS = "jane@example.com";

describe("EmailHealthRecorder", () => {
	it("reports every purpose from the start, so a silent one is visible as zero rather than absent", () => {
		const recorder = new EmailHealthRecorder();

		expect(Object.keys(recorder.snapshot().purposes).sort()).toEqual([
			"email_verification",
			"owner_invitation",
			"owner_notification",
			"password_reset",
			"team_invitation",
		]);
	});

	it("counts an attempt and its outcome per purpose", () => {
		const recorder = new EmailHealthRecorder();

		recorder.recordSuccess("password_reset");
		recorder.recordSuccess("password_reset");
		recorder.recordFailure("password_reset", new Error("Rejected by provider"));

		const reset = recorder.snapshot().purposes.password_reset;
		expect(reset).toMatchObject({ attempted: 3, failed: 1, lastFailureKind: "rejected" });
		expect(recorder.snapshot().purposes.team_invitation).toMatchObject({
			attempted: 0,
			failed: 0,
			lastFailureKind: null,
		});
	});

	it("separates a rate limit from an ordinary rejection, because the recovery differs", () => {
		const recorder = new EmailHealthRecorder();

		recorder.recordFailure("team_invitation", new Error("Too many requests"));
		expect(recorder.snapshot().purposes.team_invitation.lastFailureKind).toBe("rate_limited");

		recorder.recordFailure("owner_invitation", new Error("rate limit exceeded"));
		expect(recorder.snapshot().purposes.owner_invitation.lastFailureKind).toBe("rate_limited");

		recorder.recordFailure("email_verification", new Error("Invalid `to` field"));
		expect(recorder.snapshot().purposes.email_verification.lastFailureKind).toBe("rejected");
	});

	it("classifies a transport error as unavailable rather than a rejection", () => {
		const recorder = new EmailHealthRecorder();

		recorder.recordFailure("owner_notification", new Error("fetch failed"));

		expect(recorder.snapshot().purposes.owner_notification.lastFailureKind).toBe("unavailable");
	});

	it("never stores the address or the provider's prose", () => {
		const recorder = new EmailHealthRecorder();

		recorder.recordFailure(
			"password_reset",
			new Error(`Cannot send to ${ADDRESS}: recipient suppressed`),
		);

		const serialised = JSON.stringify(recorder.snapshot());
		expect(serialised).not.toContain(ADDRESS);
		expect(serialised).not.toContain("suppressed");
		expect(serialised).not.toContain("example.com");
	});

	it("marks itself degraded once a purpose has failed, and says which", () => {
		const recorder = new EmailHealthRecorder();

		expect(recorder.snapshot().status).toBe("ok");

		recorder.recordFailure("team_invitation", new Error("Too many requests"));

		const snapshot = recorder.snapshot();
		expect(snapshot.status).toBe("degraded");
		expect(snapshot.degradedPurposes).toEqual(["team_invitation"]);
	});
});
