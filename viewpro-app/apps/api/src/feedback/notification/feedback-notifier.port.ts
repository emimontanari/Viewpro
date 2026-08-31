import type { FeedbackType } from "@prisma/client";

export const FEEDBACK_NOTIFIER = Symbol("FEEDBACK_NOTIFIER");

export type FeedbackNotification = {
	reportId: string;
	tenantId: string;
	userId: string;
	type: FeedbackType;
	description: string;
	pathname?: string | null;
	requestId?: string | null;
	createdAt: Date;
	userEmail: string;
	tenantName: string;
};

export type FeedbackNotifier = { notify(input: FeedbackNotification): Promise<void> };
