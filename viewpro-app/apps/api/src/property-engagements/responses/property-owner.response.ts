import type { PropertyOwnerRecord } from "../property-engagements.repository";

export type PropertyOwnerResponse = ReturnType<typeof mapPropertyOwner>;

export function mapPropertyOwner(owner: PropertyOwnerRecord) {
	return {
		id: owner.id,
		propertyAssetId: owner.propertyAssetId,
		userId: owner.userId,
		email: owner.user.email,
		firstName: owner.user.firstName,
		isPrimary: owner.isPrimary,
		accessStatus: owner.accessStatus,
		createdAt: owner.createdAt.toISOString(),
		updatedAt: owner.updatedAt.toISOString(),
	};
}

export function mapPropertyOwnerSummary(owner: PropertyOwnerRecord) {
	return {
		id: owner.id,
		userId: owner.userId,
		email: owner.user.email,
		firstName: owner.user.firstName,
		isPrimary: owner.isPrimary,
		accessStatus: owner.accessStatus,
	};
}
