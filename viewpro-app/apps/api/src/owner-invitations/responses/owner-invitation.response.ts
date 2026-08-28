import type { OwnerInvitationDetails } from "../owner-invitations.repository";

export type OwnerInvitationResponse = {
	id: string;
	propertyAssetOwnerId: string;
	email: string;
	emailRegistered: boolean;
	ownerFirstName: string;
	ownerLastName: string;
	/**
	 * Enough to recognise the property, not enough to locate it. The street
	 * address is deliberately absent (#303): whoever holds this link is not
	 * necessarily the invited owner until they accept.
	 */
	property: {
		id: string;
		title: string;
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
		property: {
			id: invitation.propertyAssetOwner.propertyAsset.id,
			title: invitation.propertyAssetOwner.propertyAsset.title,
			city: invitation.propertyAssetOwner.propertyAsset.city,
			province: invitation.propertyAssetOwner.propertyAsset.province,
		},
		expiresAt: invitation.expiresAt.toISOString(),
	};
}
