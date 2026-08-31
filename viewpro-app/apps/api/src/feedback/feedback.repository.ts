import type { FeedbackType } from "@prisma/client";

export const FEEDBACK_RATE_LIMIT_REPOSITORY = Symbol("FEEDBACK_RATE_LIMIT_REPOSITORY");
export const FEEDBACK_REPOSITORY = Symbol("FEEDBACK_REPOSITORY");

export type FeedbackPair = { tenantId: string; userId: string };
export type FeedbackReportInput = FeedbackPair & {
	type: FeedbackType;
	description: string;
	pathname?: string | null;
	requestId?: string | null;
};
export type PersistedFeedbackForNotification = FeedbackReportInput & {
	id: string;
	createdAt: Date;
	user: { email: string };
	tenant: { name: string };
};
export type FeedbackRateLimitRepository = {
	reserveAttempt(input: FeedbackPair): Promise<"allowed" | "limited">;
};
export type FeedbackRepository = {
	create(input: FeedbackReportInput): Promise<PersistedFeedbackForNotification>;
};
