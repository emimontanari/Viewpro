import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type {
	FeedbackPair,
	FeedbackRateLimitRepository,
	FeedbackReportInput,
	FeedbackRepository,
	PersistedFeedbackForNotification,
} from "./feedback.repository";

const LIMIT = 5;
const WINDOW_MS = 10 * 60 * 1000;

@Injectable()
export class PrismaFeedbackRepository implements FeedbackRateLimitRepository, FeedbackRepository {
	constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

	async reserveAttempt(input: FeedbackPair): Promise<"allowed" | "limited"> {
		return this.prisma.$transaction(async (tx) => {
			const key = `${input.tenantId}:${input.userId}`;
			await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
			const rows = await tx.$queryRaw<{ now: Date }[]>`SELECT CURRENT_TIMESTAMP AS now`;
			const now = rows[0]?.now;
			if (!now) throw new Error("PostgreSQL did not return its current timestamp");
			const cutoff = new Date(now.getTime() - WINDOW_MS);
			await tx.feedbackSubmissionAttempt.deleteMany({ where: { tenantId: input.tenantId, attemptedAt: { lte: cutoff } } });
			const count = await tx.feedbackSubmissionAttempt.count({
				where: { ...input, attemptedAt: { gt: cutoff } },
			});
			if (count >= LIMIT) return "limited";
			await tx.feedbackSubmissionAttempt.create({ data: { ...input, attemptedAt: now } });
			return "allowed";
		});
	}

	create(input: FeedbackReportInput): Promise<PersistedFeedbackForNotification> {
		return this.prisma.feedbackReport.create({
			data: input,
			select: { id: true, tenantId: true, userId: true, type: true, description: true, pathname: true, requestId: true, createdAt: true, user: { select: { email: true } }, tenant: { select: { name: true } } },
		}) as Promise<PersistedFeedbackForNotification>;
	}
}
