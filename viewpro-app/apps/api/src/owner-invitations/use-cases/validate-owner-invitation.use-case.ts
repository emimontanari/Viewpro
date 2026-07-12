import {
	GoneException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { OwnerInvitationStatus } from "@prisma/client";
import { hashOwnerInvitationToken } from "../../property-engagements/owner-invitation-token";
import {
	OWNER_INVITATIONS_REPOSITORY,
	type OwnerInvitationsRepository,
} from "../owner-invitations.repository";
import {
	mapOwnerInvitation,
	type OwnerInvitationResponse,
} from "../responses/owner-invitation.response";

@Injectable()
export class ValidateOwnerInvitationUseCase {
	constructor(
		@Inject(OWNER_INVITATIONS_REPOSITORY)
		private readonly ownerInvitationsRepository: OwnerInvitationsRepository,
	) {}

	async execute(rawToken: string): Promise<OwnerInvitationResponse> {
		const invitation = await this.ownerInvitationsRepository.findByTokenHash(
			hashOwnerInvitationToken(rawToken),
		);

		if (!invitation) {
			throw new NotFoundException("Owner invitation not found");
		}

		if (invitation.status === OwnerInvitationStatus.ACCEPTED || invitation.acceptedAt) {
			throw new GoneException("Owner invitation was already accepted");
		}

		if (invitation.status === OwnerInvitationStatus.REVOKED || invitation.revokedAt) {
			throw new GoneException("Owner invitation is no longer available");
		}

		if (invitation.expiresAt.getTime() <= Date.now()) {
			throw new GoneException("Owner invitation has expired");
		}

		return mapOwnerInvitation(invitation);
	}
}
