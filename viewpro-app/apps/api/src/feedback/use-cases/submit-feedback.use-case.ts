import { Inject, Injectable, Logger } from "@nestjs/common";
import type { CurrentUser } from "../../auth/types/current-user";
import type { TenantContext } from "../../tenant-context/tenant-context.types";
import { FEEDBACK_REPOSITORY, type FeedbackRepository } from "../feedback.repository";
import { toFeedbackNotificationFailure } from "../notification/feedback-notifier.adapters";
import { FEEDBACK_NOTIFIER, type FeedbackNotifier } from "../notification/feedback-notifier.port";
import type { SubmitFeedbackDto } from "../dto/submit-feedback.dto";

@Injectable()
export class SubmitFeedbackUseCase {
	private readonly logger = new Logger(SubmitFeedbackUseCase.name);
	constructor(
		@Inject(FEEDBACK_REPOSITORY) private readonly repository: FeedbackRepository,
		@Inject(FEEDBACK_NOTIFIER) private readonly notifier: FeedbackNotifier,
	) {}

	async execute(tenant: TenantContext, user: CurrentUser, body: SubmitFeedbackDto) {
		const report = await this.repository.create({ ...body, tenantId: tenant.tenantId, userId: user.id });
		try {
			await this.notifier.notify({
				reportId: report.id, tenantId: report.tenantId, userId: report.userId, type: report.type,
				description: report.description, pathname: report.pathname, requestId: report.requestId,
				createdAt: report.createdAt, userEmail: report.user.email, tenantName: report.tenant.name,
			});
		} catch (error) {
			const { category, code } = toFeedbackNotificationFailure(error).diagnostic;
			this.logger.warn({ reportId: report.id, timestamp: report.createdAt.toISOString(), category, code });
		}
		return { accepted: true };
	}
}
