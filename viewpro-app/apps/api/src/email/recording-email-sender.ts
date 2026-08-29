import { Injectable } from "@nestjs/common";
import type { EmailPurpose } from "./email-health.recorder";
import { EmailHealthRecorder } from "./email-health.recorder";
import type {
	EmailSender,
	SendEmailVerificationInput,
	SendOwnerInvitationInput,
	SendOwnerNotificationInput,
	SendPasswordResetInput,
	SendTeamInvitationInput,
} from "./email-sender.port";

/**
 * Wraps an EmailSender and records the outcome of every send.
 *
 * A decorator rather than instrumentation inside the Resend adapter, so the
 * counts hold for whichever sender is configured — including the no-op one
 * used when RESEND_API_KEY is unset, where "nothing is being sent" is exactly
 * the state worth being able to see.
 *
 * It re-throws. Callers already treat a failed send as non-fatal on purpose;
 * swallowing it here would take that decision away from them and hide the
 * failure from their own logs.
 */
@Injectable()
export class RecordingEmailSender implements EmailSender {
	constructor(
		private readonly inner: EmailSender,
		private readonly recorder: EmailHealthRecorder,
	) {}

	sendTeamInvitation(input: SendTeamInvitationInput): Promise<void> {
		return this.record("team_invitation", () => this.inner.sendTeamInvitation(input));
	}

	sendOwnerInvitation(input: SendOwnerInvitationInput): Promise<void> {
		return this.record("owner_invitation", () => this.inner.sendOwnerInvitation(input));
	}

	sendPasswordReset(input: SendPasswordResetInput): Promise<void> {
		return this.record("password_reset", () => this.inner.sendPasswordReset(input));
	}

	sendEmailVerification(input: SendEmailVerificationInput): Promise<void> {
		return this.record("email_verification", () => this.inner.sendEmailVerification(input));
	}

	sendOwnerNotification(input: SendOwnerNotificationInput): Promise<void> {
		return this.record("owner_notification", () => this.inner.sendOwnerNotification(input));
	}

	private async record(purpose: EmailPurpose, send: () => Promise<void>): Promise<void> {
		try {
			await send();
		} catch (error) {
			this.recorder.recordFailure(purpose, error);
			throw error;
		}

		this.recorder.recordSuccess(purpose);
	}
}
