import type { PropertyOwnerRecord } from "../property-engagements.repository";

export type PropertyOwnerResponse = ReturnType<typeof mapPropertyOwner>;

export function mapPropertyOwner(owner: PropertyOwnerRecord) {
	return {
		id: owner.id,
		propertyAssetId: owner.propertyAssetId,
		userId: owner.userId,
		email: owner.ownerEmail || owner.user?.email || "",
		firstName: owner.user?.firstName ?? owner.ownerFirstName,
		lastName: owner.user?.lastName ?? owner.ownerLastName,
		ownerFirstName: owner.ownerFirstName,
		ownerLastName: owner.ownerLastName,
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
		email: owner.ownerEmail || owner.user?.email || "",
		firstName: owner.user?.firstName ?? owner.ownerFirstName,
		lastName: owner.user?.lastName ?? owner.ownerLastName,
		ownerFirstName: owner.ownerFirstName,
		ownerLastName: owner.ownerLastName,
		isPrimary: owner.isPrimary,
		accessStatus: owner.accessStatus,
	};
}
