import { Inject, Injectable } from "@nestjs/common";
import type { CurrentUser } from "../../auth/types/current-user";
import type { TenantContext } from "../../tenant-context/tenant-context.types";
import { FEEDBACK_REPOSITORY, type FeedbackRepository } from "../feedback.repository";
import type { SubmitFeedbackDto } from "../dto/submit-feedback.dto";

@Injectable()
export class SubmitFeedbackUseCase {
	constructor(@Inject(FEEDBACK_REPOSITORY) private readonly repository: FeedbackRepository) {}

	async execute(tenant: TenantContext, user: CurrentUser, body: SubmitFeedbackDto) {
		await this.repository.create({ ...body, tenantId: tenant.tenantId, userId: user.id });
		return { accepted: true };
	}
}
