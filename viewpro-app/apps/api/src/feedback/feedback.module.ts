import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MembershipsModule } from "../memberships/memberships.module";
import { TenantContextModule } from "../tenant-context/tenant-context.module";
import { FeedbackController } from "./feedback.controller";
import { FeedbackRateLimitGuard } from "./feedback-rate-limit.guard";
import { FEEDBACK_RATE_LIMIT_REPOSITORY, FEEDBACK_REPOSITORY } from "./feedback.repository";
import { PrismaFeedbackRepository } from "./prisma-feedback.repository";
import { SubmitFeedbackUseCase } from "./use-cases/submit-feedback.use-case";

@Module({
	imports: [AuthModule, MembershipsModule, TenantContextModule],
	controllers: [FeedbackController],
	providers: [
		PrismaFeedbackRepository,
		{ provide: FEEDBACK_RATE_LIMIT_REPOSITORY, useExisting: PrismaFeedbackRepository },
		{ provide: FEEDBACK_REPOSITORY, useExisting: PrismaFeedbackRepository },
		FeedbackRateLimitGuard,
		SubmitFeedbackUseCase,
	],
})
export class FeedbackModule {}
