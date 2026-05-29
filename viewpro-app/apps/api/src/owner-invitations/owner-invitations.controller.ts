import {
	Body,
	Controller,
	Get,
	Inject,
	Param,
	Post,
	Res,
	UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { AuthThrottlerGuard } from "../auth/guards/auth-throttler.guard";
import { TokenService } from "../auth/tokens/token.service";
import { getAuthRateLimitConfig } from "../config/app.config";
// biome-ignore lint/style/useImportType: Nest validation pipe needs runtime DTO metadata.
import { AcceptOwnerInvitationDto } from "./dto/accept-owner-invitation.dto";
import { AcceptOwnerInvitationUseCase } from "./use-cases/accept-owner-invitation.use-case";
import { ValidateOwnerInvitationUseCase } from "./use-cases/validate-owner-invitation.use-case";

const authRateLimit = getAuthRateLimitConfig();

function toThrottleOptions(config: { limit: number; ttlSeconds: number }) {
	return { default: { limit: config.limit, ttl: config.ttlSeconds * 1000 } };
}

@Controller("owner-invitations")
export class OwnerInvitationsController {
	constructor(
		@Inject(ValidateOwnerInvitationUseCase)
		private readonly validateOwnerInvitationUseCase: ValidateOwnerInvitationUseCase,
		@Inject(AcceptOwnerInvitationUseCase)
		private readonly acceptOwnerInvitationUseCase: AcceptOwnerInvitationUseCase,
		@Inject(TokenService) private readonly tokenService: TokenService,
	) {}

	@Get(":token")
	validate(@Param("token") token: string) {
		return this.validateOwnerInvitationUseCase.execute(token);
	}

	@Post(":token/accept")
	@UseGuards(AuthThrottlerGuard)
	@Throttle(toThrottleOptions(authRateLimit.register))
	async accept(
		@Param("token") token: string,
		@Body() dto: AcceptOwnerInvitationDto,
		@Res({ passthrough: true }) response: Response,
	) {
		const result = await this.acceptOwnerInvitationUseCase.execute(token, dto);
		this.tokenService.setAuthCookies(
			response,
			result.accessToken,
			result.refreshToken,
		);
		return result.body;
	}
}
