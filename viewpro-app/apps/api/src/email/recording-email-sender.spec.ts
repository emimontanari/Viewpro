import { describe, expect, it, vi } from "vitest";
import { EmailHealthRecorder } from "./email-health.recorder";
import { RecordingEmailSender } from "./recording-email-sender";
import type { EmailSender } from "./email-sender.port";

function stubSender(overrides: Partial<EmailSender> = {}): EmailSender {
	return {
		sendTeamInvitation: vi.fn().mockResolvedValue(undefined),
		sendOwnerInvitation: vi.fn().mockResolvedValue(undefined),
		sendPasswordReset: vi.fn().mockResolvedValue(undefined),
		sendEmailVerification: vi.fn().mockResolvedValue(undefined),
		sendOwnerNotification: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}

const VERIFICATION = { to: "jane@example.com", verificationUrl: "https://x/v" };

describe("RecordingEmailSender", () => {
	it("passes the send through untouched", async () => {
		const inner = stubSender();
		const recorder = new EmailHealthRecorder();

		await new RecordingEmailSender(inner, recorder).sendEmailVerification(VERIFICATION);

		expect(inner.sendEmailVerification).toHaveBeenCalledWith(VERIFICATION);
	});

	it("re-throws, because the caller decides whether a failed send is fatal", async () => {
		const failure = new Error("Too many requests");
		const inner = stubSender({ sendPasswordReset: vi.fn().mockRejectedValue(failure) });
		const recorder = new EmailHealthRecorder();

		await expect(
			new RecordingEmailSender(inner, recorder).sendPasswordReset({
				to: "jane@example.com",
				resetUrl: "https://x/r",
				expiresAt: new Date(),
			}),
		).rejects.toThrow("Too many requests");
	});

	it("records the failure under the purpose that failed, and only that one", async () => {
		const inner = stubSender({
			sendPasswordReset: vi.fn().mockRejectedValue(new Error("Too many requests")),
		});
		const recorder = new EmailHealthRecorder();
		const sender = new RecordingEmailSender(inner, recorder);

		await sender.sendEmailVerification(VERIFICATION);
		await expect(
			sender.sendPasswordReset({
				to: "jane@example.com",
				resetUrl: "https://x/r",
				expiresAt: new Date(),
			}),
		).rejects.toThrow('Too many requests');

		const snapshot = recorder.snapshot();
		expect(snapshot.purposes.password_reset).toMatchObject({
			attempted: 1,
			failed: 1,
			lastFailureKind: "rate_limited",
		});
		expect(snapshot.purposes.email_verification).toMatchObject({ attempted: 1, failed: 0 });
		expect(snapshot.degradedPurposes).toEqual(["password_reset"]);
	});

	it("covers every purpose the port declares", async () => {
		const inner = stubSender();
		const recorder = new EmailHealthRecorder();
		const sender = new RecordingEmailSender(inner, recorder);

		await sender.sendTeamInvitation({
			to: "a@b.test",
			role: "AGENT",
			invitationUrl: "https://x/t",
			expiresAt: new Date(),
		});
		await sender.sendOwnerInvitation({
			to: "a@b.test",
			invitationUrl: "https://x/o",
			expiresAt: new Date(),
		});
		await sender.sendPasswordReset({
			to: "a@b.test",
			resetUrl: "https://x/r",
			expiresAt: new Date(),
		});
		await sender.sendEmailVerification(VERIFICATION);
		await sender.sendOwnerNotification({
			to: "a@b.test",
			notificationType: "DOCUMENT_REQUESTED",
			body: "b",
			url: "https://x/n",
		});

		const { purposes } = recorder.snapshot();
		expect(Object.values(purposes).map((p) => p.attempted)).toEqual([1, 1, 1, 1, 1]);
	});
});
