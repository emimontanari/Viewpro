import { createResendClient, type ResendClient } from "../../email/resend-email-sender";
import { renderFeedbackEmail } from "./feedback-email.template";
import type { FeedbackNotification, FeedbackNotifier } from "./feedback-notifier.port";

export type FeedbackNotificationDiagnostic = {
	category: "rate_limited" | "unavailable" | "rejected" | "unknown";
	code: "RESEND_RATE_LIMITED" | "RESEND_UNAVAILABLE" | "RESEND_REJECTED" | "FEEDBACK_NOTIFICATION_UNKNOWN";
};

export class FeedbackNotificationFailure extends Error {
	readonly category: FeedbackNotificationDiagnostic["category"];
	readonly code: FeedbackNotificationDiagnostic["code"];
	constructor(readonly diagnostic: FeedbackNotificationDiagnostic) {
		super(diagnostic.code); this.category = diagnostic.category; this.code = diagnostic.code;
	}
}

export function toFeedbackNotificationFailure(error: unknown): FeedbackNotificationFailure {
	if (error instanceof FeedbackNotificationFailure) return error;
	const message = error instanceof Error ? error.message.toLowerCase() : "";
	const diagnostic: FeedbackNotificationDiagnostic = /rate.?limit/.test(message)
		? { category: "rate_limited", code: "RESEND_RATE_LIMITED" }
		: /unavailable|timeout|network/.test(message)
			? { category: "unavailable", code: "RESEND_UNAVAILABLE" }
			: /reject|invalid|forbidden/.test(message)
				? { category: "rejected", code: "RESEND_REJECTED" }
				: { category: "unknown", code: "FEEDBACK_NOTIFICATION_UNKNOWN" };
	return new FeedbackNotificationFailure(diagnostic);
}

export class ResendFeedbackNotifier implements FeedbackNotifier {
	constructor(private readonly from: string, private readonly recipient: string, private readonly client?: ResendClient) {}
	async notify(input: FeedbackNotification) {
		const email = renderFeedbackEmail(input);
		try {
			const result = await (this.client ?? createResendClient("")).emails.send({ from: this.from, to: this.recipient, ...email });
			if (result.error) throw new Error(result.error.message);
		} catch (error) { throw toFeedbackNotificationFailure(error); }
	}
}

export class NoopFeedbackNotifier implements FeedbackNotifier { async notify(_: FeedbackNotification) {} }

export function createFeedbackNotifier(config: { nodeEnv: string; apiKey?: string; fromAddress: string; feedbackRecipient?: string }): FeedbackNotifier {
	if (config.nodeEnv !== "production") return new NoopFeedbackNotifier();
	return new ResendFeedbackNotifier(
		config.fromAddress, config.feedbackRecipient!, config.apiKey ? createResendClient(config.apiKey) : undefined,
	);
}
