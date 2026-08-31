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
	emailRegistered: boolean;
	status: OwnerInvitationStatus;
	expiresAt: Date;
	acceptedAt: Date | null;
	revokedAt: Date | null;
	/**
	 * The engagement this invitation was created from. Null for invitations
	 * created before that was recorded, and for one whose engagement was
	 * archived — both keep the generic copy rather than a derived guess (#303).
	 */
	propertyEngagement: { tenant: { name: string } } | null;
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

export type AcceptExistingOwnerInvitationInput = {
	tokenHash: string;
	userId: string;
	now: Date;
};

export type AcceptOwnerInvitationResult =
	| { status: "accepted"; user: User }
	| { status: "notFound" }
	| { status: "expired" }
	| { status: "revoked" }
	| { status: "alreadyAccepted" }
	| { status: "userAlreadyExists" }
	| { status: "emailMismatch" };

export type OwnerInvitationsRepository = {
	findByTokenHash(tokenHash: string): Promise<OwnerInvitationDetails | null>;
	findUserByEmail(email: string): Promise<User | null>;
	acceptForNewOwner(
		input: AcceptOwnerInvitationInput,
	): Promise<AcceptOwnerInvitationResult>;
	acceptForExistingOwner(
		input: AcceptExistingOwnerInvitationInput,
	): Promise<AcceptOwnerInvitationResult>;
};
