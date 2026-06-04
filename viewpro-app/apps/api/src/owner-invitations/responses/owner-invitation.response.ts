import type { OwnerInvitationDetails } from "../owner-invitations.repository";

export type OwnerInvitationResponse = {
	id: string;
	propertyAssetOwnerId: string;
	email: string;
	emailRegistered: boolean;
	ownerFirstName: string;
	ownerLastName: string;
	property: {
		id: string;
		title: string;
		addressLine: string;
		city: string;
		province: string;
	};
	expiresAt: string;
};

export function mapOwnerInvitation(
	invitation: OwnerInvitationDetails,
): OwnerInvitationResponse {
	return {
		id: invitation.id,
		propertyAssetOwnerId: invitation.propertyAssetOwnerId,
		email: invitation.email,
		emailRegistered: invitation.emailRegistered,
		ownerFirstName: invitation.propertyAssetOwner.ownerFirstName,
		ownerLastName: invitation.propertyAssetOwner.ownerLastName,
		property: invitation.propertyAssetOwner.propertyAsset,
		expiresAt: invitation.expiresAt.toISOString(),
	};
}
