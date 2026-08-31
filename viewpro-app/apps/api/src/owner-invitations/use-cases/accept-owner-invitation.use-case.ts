import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	GoneException,
	Inject,
	Injectable,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
import { OwnerInvitationStatus } from "@prisma/client";
import { mapAuthUser } from "../../auth/responses/auth-user.response";
import type { MeResponse } from "../../auth/responses/me.response";
import type { PasswordHasher } from "../../auth/security/password-hasher";
import { PASSWORD_HASHER } from "../../auth/security/password-hasher";
import type { RefreshTokenRepository } from "../../auth/tokens/refresh-token.repository";
import { REFRESH_TOKEN_REPOSITORY } from "../../auth/tokens/refresh-token.repository";
import { TokenService } from "../../auth/tokens/token.service";
import type { CurrentUser } from "../../auth/types/current-user";
import type { AuthSessionResult } from "../../auth/use-cases/register-tenant.use-case";
import { normalizeEmail } from "../../auth/utils/slugify";
import { hashOwnerInvitationToken } from "../../property-engagements/owner-invitation-token";
import type { AcceptOwnerInvitationDto } from "../dto/accept-owner-invitation.dto";
import { mapMembership } from "../../auth/responses/me.response";
import type { MembershipsRepository } from "../../memberships/memberships.repository";
import { MEMBERSHIPS_REPOSITORY } from "../../memberships/memberships.repository";
import {
	OWNER_INVITATIONS_REPOSITORY,
	type AcceptOwnerInvitationResult,
	type OwnerInvitationDetails,
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
		@Inject(MEMBERSHIPS_REPOSITORY)
		private readonly membershipsRepository: MembershipsRepository,
	) {}

	async execute(
		rawToken: string,
		dto: AcceptOwnerInvitationDto,
		currentUser?: CurrentUser | null,
	): Promise<AuthSessionResult> {
		const tokenHash = hashOwnerInvitationToken(rawToken);
		const result = await this.acceptInvitation(tokenHash, dto, currentUser);

		if (result.status !== "accepted") {
			this.throwForAcceptResult(result);
		}

		return this.createSession(result.user);
	}

	private async acceptInvitation(
		tokenHash: string,
		dto: AcceptOwnerInvitationDto,
		currentUser?: CurrentUser | null,
	): Promise<AcceptOwnerInvitationResult> {
		const mode = dto.mode ?? "register";

		if (mode === "register") {
			const firstName = dto.firstName?.trim() ?? "";
			const lastName = dto.lastName?.trim() || undefined;

			if (!firstName) {
				throw new BadRequestException("Owner first name is required");
			}

			if (!dto.password) {
				throw new BadRequestException("Password is required");
			}

			if (currentUser) {
				const invitation = await this.validateInvitationForCredentialFlow(tokenHash);
				this.assertMatchingEmail(currentUser.email, invitation.email);
			}

			const passwordHash = await this.passwordHasher.hash(dto.password);
			return this.ownerInvitationsRepository.acceptForNewOwner({
				tokenHash,
				passwordHash,
				firstName,
				lastName,
				now: new Date(),
			});
		}

		const invitation = await this.validateInvitationForCredentialFlow(tokenHash);

		if (mode === "login") {
			if (!dto.password) {
				throw new BadRequestException("Password is required");
			}

			if (currentUser) {
				this.assertMatchingEmail(currentUser.email, invitation.email);
			}

			const user = await this.ownerInvitationsRepository.findUserByEmail(
				invitation.email,
			);
			const validPassword = user
				? await this.passwordHasher.verify(user.passwordHash, dto.password)
				: false;

			if (!user || !validPassword) {
				throw new UnauthorizedException({ errorCode: "INVITATION_INVALID_CREDENTIALS", message: "Invalid email or password" });
			}

			return this.ownerInvitationsRepository.acceptForExistingOwner({
				tokenHash,
				userId: user.id,
				now: new Date(),
			});
		}

		if (mode === "current-session") {
			if (!currentUser) {
				throw new UnauthorizedException({ errorCode: "SESSION_EXPIRED", message: "Authentication required" });
			}

			this.assertMatchingEmail(currentUser.email, invitation.email);
			return this.ownerInvitationsRepository.acceptForExistingOwner({
				tokenHash,
				userId: currentUser.id,
				now: new Date(),
			});
		}

		throw new BadRequestException("Unsupported owner invitation acceptance mode");
	}

	private async validateInvitationForCredentialFlow(tokenHash: string) {
		const invitation = await this.ownerInvitationsRepository.findByTokenHash(tokenHash);

		if (!invitation) {
			throw new NotFoundException({ errorCode: "INVITATION_NOT_FOUND", message: "Owner invitation not found" });
		}

		this.throwForInvitationAvailability(invitation);
		return invitation;
	}

	private assertMatchingEmail(userEmail: string, invitationEmail: string) {
		if (normalizeEmail(userEmail) !== normalizeEmail(invitationEmail)) {
			throw new ForbiddenException({ errorCode: "INVITATION_EMAIL_MISMATCH", message: "Owner invitation belongs to another email" });
		}
	}

	private throwForInvitationAvailability(invitation: OwnerInvitationDetails) {
		if (invitation.status === OwnerInvitationStatus.ACCEPTED || invitation.acceptedAt) {
			throw new GoneException({ errorCode: "INVITATION_ALREADY_ACCEPTED", message: "Owner invitation was already accepted" });
		}

		if (invitation.status === OwnerInvitationStatus.REVOKED || invitation.revokedAt) {
			throw new GoneException({ errorCode: "INVITATION_REVOKED", message: "Owner invitation is no longer available" });
		}

		if (invitation.expiresAt.getTime() <= Date.now()) {
			throw new GoneException({ errorCode: "INVITATION_EXPIRED", message: "Owner invitation has expired" });
		}
	}

	private throwForAcceptResult(
		result: Exclude<AcceptOwnerInvitationResult, { status: "accepted" }>,
	): never {
		if (result.status === "notFound") {
			throw new NotFoundException({ errorCode: "INVITATION_NOT_FOUND", message: "Owner invitation not found" });
		}

		if (result.status === "expired") {
			throw new GoneException({ errorCode: "INVITATION_EXPIRED", message: "Owner invitation has expired" });
		}

		if (result.status === "revoked") {
			throw new GoneException({ errorCode: "INVITATION_REVOKED", message: "Owner invitation is no longer available" });
		}

		if (result.status === "alreadyAccepted") {
			throw new GoneException({ errorCode: "INVITATION_ALREADY_ACCEPTED", message: "Owner invitation was already accepted" });
		}

		if (result.status === "userAlreadyExists") {
			throw new ConflictException({ errorCode: "INVITATION_EMAIL_ALREADY_REGISTERED", message: "Owner email is already registered" });
		}

		if (result.status === "emailMismatch") {
			throw new ForbiddenException({ errorCode: "INVITATION_EMAIL_MISMATCH", message: "Owner invitation belongs to another email" });
		}

		throw new UnauthorizedException({ errorCode: "SESSION_EXPIRED", message: "Authentication required" });
	}

	private async createSession(
		user: Extract<AcceptOwnerInvitationResult, { status: "accepted" }>["user"],
	): Promise<AuthSessionResult> {
		const accessToken = await this.tokenService.signAccessToken({
			sub: user.id,
			email: user.email,
		});
		const refreshToken = this.tokenService.generateRefreshToken();

		await this.refreshTokenRepository.create({
			userId: user.id,
			tokenHash: this.tokenService.hashRefreshToken(refreshToken),
			expiresAt: this.tokenService.getRefreshTokenExpiresAt(),
		});

		// Was hardcoded to []. An existing seller can accept an owner invitation
		// through the login mode, and that returned a session claiming they had no
		// memberships — the same dual-context erasure this issue is about, in the
		// other direction (#326, criterion 9).
		const memberships = await this.membershipsRepository.findActiveManyByUserId(user.id);

		const body: MeResponse = {
			user: mapAuthUser(user),
			memberships: memberships.map(mapMembership),
			// Accepting is what activates owner access, so this is a fact of what
			// just happened rather than a value to look up.
			hasOwnerAccess: true,
		};
		return { accessToken, refreshToken, body };
	}
}
