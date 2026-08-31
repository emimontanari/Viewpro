import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthModule } from "../auth/auth.module";
import { MembershipsModule } from "../memberships/memberships.module";
import { TenantContextModule } from "../tenant-context/tenant-context.module";
import { FeedbackController } from "./feedback.controller";
import { FeedbackRateLimitGuard } from "./feedback-rate-limit.guard";
import { FEEDBACK_RATE_LIMIT_REPOSITORY, FEEDBACK_REPOSITORY } from "./feedback.repository";
import { PrismaFeedbackRepository } from "./prisma-feedback.repository";
import { createFeedbackNotifier } from "./notification/feedback-notifier.adapters";
import { FEEDBACK_NOTIFIER } from "./notification/feedback-notifier.port";
import { SubmitFeedbackUseCase } from "./use-cases/submit-feedback.use-case";

@Module({
	imports: [AuthModule, MembershipsModule, TenantContextModule],
	controllers: [FeedbackController],
	providers: [
		PrismaFeedbackRepository,
		{ provide: FEEDBACK_RATE_LIMIT_REPOSITORY, useExisting: PrismaFeedbackRepository },
		{ provide: FEEDBACK_REPOSITORY, useExisting: PrismaFeedbackRepository },
		{
			provide: FEEDBACK_NOTIFIER,
			inject: [ConfigService],
			useFactory: (config: ConfigService) => createFeedbackNotifier({
				nodeEnv: config.getOrThrow("app.nodeEnv"), apiKey: config.get("app.email.apiKey"),
				fromAddress: config.getOrThrow("app.email.fromAddress"), feedbackRecipient: config.get("app.email.feedbackRecipient"),
			}),
		},
		FeedbackRateLimitGuard,
		SubmitFeedbackUseCase,
	],
})
export class FeedbackModule {}
