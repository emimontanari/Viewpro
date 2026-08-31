import { type CanActivate, type ExecutionContext, HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import { FEEDBACK_RATE_LIMIT_REPOSITORY, type FeedbackRateLimitRepository } from "./feedback.repository";

@Injectable()
export class FeedbackRateLimitGuard implements CanActivate {
	constructor(@Inject(FEEDBACK_RATE_LIMIT_REPOSITORY) private readonly repository: FeedbackRateLimitRepository) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<{ user: { id: string }; tenantContext: { tenantId: string } }>();
		const result = await this.repository.reserveAttempt({ tenantId: request.tenantContext.tenantId, userId: request.user.id });
		if (result === "limited") throw new HttpException("Too many requests", HttpStatus.TOO_MANY_REQUESTS);
		return true;
	}
}
