import type {
	OwnerInvitationStatus,
	PropertyAssetOwnerAccessStatus,
	User,
} from "@prisma/client";

export const OWNER_INVITATIONS_REPOSITORY = Symbol(
	"OWNER_INVITATIONS_REPOSITORY",
);

export type OwnerInvitationDetails = {
	id: string;
	propertyAssetOwnerId: string;
	email: string;
	status: OwnerInvitationStatus;
	expiresAt: Date;
	acceptedAt: Date | null;
	revokedAt: Date | null;
	propertyAssetOwner: {
		id: string;
		ownerEmail: string;
		ownerFirstName: string;
		ownerLastName: string;
		accessStatus: PropertyAssetOwnerAccessStatus;
		userId: string | null;
		propertyAsset: {
			id: string;
			title: string;
			addressLine: string;
			city: string;
			province: string;
		};
	};
};

export type AcceptOwnerInvitationInput = {
	tokenHash: string;
	passwordHash: string;
	firstName: string;
	lastName?: string;
	now: Date;
};

export type AcceptOwnerInvitationResult =
	| { status: "accepted"; user: User }
	| { status: "notFound" }
	| { status: "expired" }
	| { status: "revoked" }
	| { status: "alreadyAccepted" }
	| { status: "userAlreadyExists" };

export type OwnerInvitationsRepository = {
	findByTokenHash(tokenHash: string): Promise<OwnerInvitationDetails | null>;
	acceptForNewOwner(
		input: AcceptOwnerInvitationInput,
	): Promise<AcceptOwnerInvitationResult>;
};
