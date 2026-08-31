import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import type { CurrentUser as CurrentUserContext } from "../auth/types/current-user";
import { CurrentTenant } from "../tenant-context/current-tenant.decorator";
import { ApiTenantContext } from "../tenant-context/tenant-context-api-docs.decorator";
import { TenantMembershipGuard } from "../tenant-context/tenant-membership.guard";
import type { TenantContext } from "../tenant-context/tenant-context.types";
import { SubmitFeedbackDto } from "./dto/submit-feedback.dto";
import { FeedbackRateLimitGuard } from "./feedback-rate-limit.guard";
import { SubmitFeedbackUseCase } from "./use-cases/submit-feedback.use-case";

@Controller("feedback")
@ApiTenantContext()
@UseGuards(AuthGuard, TenantMembershipGuard, FeedbackRateLimitGuard)
export class FeedbackController {
	constructor(@Inject(SubmitFeedbackUseCase) private readonly submitFeedbackUseCase: SubmitFeedbackUseCase) {}

	@Post()
	submit(@CurrentTenant() tenant: TenantContext, @CurrentUser() user: CurrentUserContext, @Body() body: SubmitFeedbackDto) {
		return this.submitFeedbackUseCase.execute(tenant, user, body);
	}
}
