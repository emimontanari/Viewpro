import { Injectable } from "@nestjs/common";

/**
 * The five things this system sends. Named rather than derived so a purpose
 * that stops being sent shows up as zero attempts instead of disappearing.
 */
export const EMAIL_PURPOSES = [
	"email_verification",
	"owner_invitation",
	"owner_notification",
	"password_reset",
	"team_invitation",
] as const;

export type EmailPurpose = (typeof EMAIL_PURPOSES)[number];

/**
 * Why a send failed, at the only granularity that changes what an operator
 * does about it:
 *
 * - `rate_limited` — back off and retry; the provider is fine.
 * - `unavailable`  — the provider could not be reached at all.
 * - `rejected`     — the provider refused this message; retrying it unchanged
 *                    will refuse again.
 */
export type EmailFailureKind = "rate_limited" | "unavailable" | "rejected";

export type EmailPurposeHealth = {
	attempted: number;
	failed: number;
	lastFailureAt: string | null;
	lastFailureKind: EmailFailureKind | null;
};

export type EmailHealthSnapshot = {
	status: "ok" | "degraded";
	degradedPurposes: EmailPurpose[];
	purposes: Record<EmailPurpose, EmailPurposeHealth>;
};

const RATE_LIMIT_PATTERN = /rate.?limit|too many requests|429/i;
const UNAVAILABLE_PATTERN = /fetch failed|econnrefused|enotfound|etimedout|network|socket/i;

/**
 * Counts transactional email outcomes per purpose.
 *
 * Deliberately holds no message, address or body. The provider's prose is the
 * one place a recipient address reliably shows up — "Cannot send to
 * jane@example.com" — so failures are classified on the way in and the text is
 * dropped. What survives is a count, a timestamp and a kind, which is what an
 * operator acts on and is safe to expose unauthenticated.
 *
 * In-memory and per-process on purpose: this answers "is mail working right
 * now", not "how much did we send last month". A restart resetting it is
 * correct, not a gap.
 */
@Injectable()
export class EmailHealthRecorder {
	private readonly purposes = new Map<EmailPurpose, EmailPurposeHealth>(
		EMAIL_PURPOSES.map((purpose) => [
			purpose,
			{ attempted: 0, failed: 0, lastFailureAt: null, lastFailureKind: null },
		]),
	);

	recordSuccess(purpose: EmailPurpose): void {
		this.entry(purpose).attempted += 1;
	}

	recordFailure(purpose: EmailPurpose, error: unknown): void {
		const entry = this.entry(purpose);
		entry.attempted += 1;
		entry.failed += 1;
		entry.lastFailureAt = new Date().toISOString();
		entry.lastFailureKind = classify(error);
	}

	snapshot(): EmailHealthSnapshot {
		const purposes = Object.fromEntries(
			EMAIL_PURPOSES.map((purpose) => [purpose, { ...this.entry(purpose) }]),
		) as Record<EmailPurpose, EmailPurposeHealth>;

		const degradedPurposes = EMAIL_PURPOSES.filter((purpose) => purposes[purpose].failed > 0);

		return {
			status: degradedPurposes.length > 0 ? "degraded" : "ok",
			degradedPurposes,
			purposes,
		};
	}

	private entry(purpose: EmailPurpose): EmailPurposeHealth {
		const entry = this.purposes.get(purpose);
		if (!entry) {
			throw new Error(`Unknown email purpose: ${purpose}`);
		}
		return entry;
	}
}

function classify(error: unknown): EmailFailureKind {
	const message = error instanceof Error ? error.message : String(error);

	if (RATE_LIMIT_PATTERN.test(message)) return "rate_limited";
	if (UNAVAILABLE_PATTERN.test(message)) return "unavailable";
	return "rejected";
}
