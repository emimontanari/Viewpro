import {
	BadRequestException,
	ConflictException,
	GoneException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { mapAuthUser } from "../../auth/responses/auth-user.response";
import type { MeResponse } from "../../auth/responses/me.response";
import type { PasswordHasher } from "../../auth/security/password-hasher";
import { PASSWORD_HASHER } from "../../auth/security/password-hasher";
import type { RefreshTokenRepository } from "../../auth/tokens/refresh-token.repository";
import { REFRESH_TOKEN_REPOSITORY } from "../../auth/tokens/refresh-token.repository";
import { TokenService } from "../../auth/tokens/token.service";
import type { AuthSessionResult } from "../../auth/use-cases/register-tenant.use-case";
import { hashOwnerInvitationToken } from "../../property-engagements/owner-invitation-token";
import type { AcceptOwnerInvitationDto } from "../dto/accept-owner-invitation.dto";
import {
	OWNER_INVITATIONS_REPOSITORY,
	type OwnerInvitationsRepository,
} from "../owner-invitations.repository";

@Injectable()
export class AcceptOwnerInvitationUseCase {
	constructor(
		@Inject(OWNER_INVITATIONS_REPOSITORY)
		private readonly ownerInvitationsRepository: OwnerInvitationsRepository,
		@Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
		@Inject(REFRESH_TOKEN_REPOSITORY)
		private readonly refreshTokenRepository: RefreshTokenRepository,
		@Inject(TokenService) private readonly tokenService: TokenService,
	) {}

	async execute(
		rawToken: string,
		dto: AcceptOwnerInvitationDto,
	): Promise<AuthSessionResult> {
		const firstName = dto.firstName.trim();
		const lastName = dto.lastName?.trim() || undefined;

		if (!firstName) {
			throw new BadRequestException("Owner first name is required");
		}

		const passwordHash = await this.passwordHasher.hash(dto.password);
		const result = await this.ownerInvitationsRepository.acceptForNewOwner({
			tokenHash: hashOwnerInvitationToken(rawToken),
			passwordHash,
			firstName,
			lastName,
			now: new Date(),
		});

		if (result.status === "notFound") {
			throw new NotFoundException("Owner invitation not found");
		}

		if (result.status === "expired") {
			throw new GoneException("Owner invitation has expired");
		}

		if (result.status === "revoked") {
			throw new GoneException("Owner invitation is no longer available");
		}

		if (result.status === "alreadyAccepted") {
			throw new GoneException("Owner invitation was already accepted");
		}

		if (result.status === "userAlreadyExists") {
			throw new ConflictException("Owner email is already registered");
		}

		const accessToken = await this.tokenService.signAccessToken({
			sub: result.user.id,
			email: result.user.email,
		});
		const refreshToken = this.tokenService.generateRefreshToken();

		await this.refreshTokenRepository.create({
			userId: result.user.id,
			tokenHash: this.tokenService.hashRefreshToken(refreshToken),
			expiresAt: this.tokenService.getRefreshTokenExpiresAt(),
		});

		const body: MeResponse = { user: mapAuthUser(result.user), memberships: [] };
		return { accessToken, refreshToken, body };
	}
}
