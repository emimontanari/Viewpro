import type {
	OwnerInvitationStatus,
	PropertyAssetOwnerAccessStatus,
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

export type OwnerInvitationsRepository = {
	findByTokenHash(tokenHash: string): Promise<OwnerInvitationDetails | null>;
};
