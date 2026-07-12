import type { PropertyAssetImage } from "@prisma/client";
import type { OwnerPropertyRecord } from "../owner-portal.repository";
import { mapPropertyImage } from "../../property-engagements/responses/property-engagement.response";

export type OwnerPropertyImageResponse = ReturnType<
	typeof mapOwnerPropertyImage
>;
export type OwnerPropertyResponse = ReturnType<typeof mapOwnerProperty>;

export function mapOwnerProperty(property: OwnerPropertyRecord) {
	const propertyImages =
		"images" in property && Array.isArray(property.images)
			? property.images
			: [];
	const images = [...propertyImages]
		.sort(comparePropertyImages)
		.map(mapOwnerPropertyImage);
	const primaryImage =
		images.find((image) => image.isPrimary) ?? images[0] ?? null;

	return {
		id: property.id,
		title: property.title,
		addressLine: property.addressLine,
		city: property.city,
		province: property.province,
		propertyType: property.propertyType,
		totalAreaSqm: property.totalAreaSqm,
		coveredAreaSqm: property.coveredAreaSqm,
		rooms: property.rooms,
		bedrooms: property.bedrooms,
		bathrooms: property.bathrooms,
		garages: property.garages,
		ageYears: property.ageYears,
		orientation: property.orientation,
		images,
		primaryImage,
		createdAt: property.createdAt.toISOString(),
		updatedAt: property.updatedAt.toISOString(),
	};
}

function mapOwnerPropertyImage(image: PropertyAssetImage) {
	return mapPropertyImage(image);
}

function comparePropertyImages(
	firstImage: PropertyAssetImage,
	secondImage: PropertyAssetImage,
) {
	if (firstImage.isPrimary !== secondImage.isPrimary) {
		return firstImage.isPrimary ? -1 : 1;
	}

	return firstImage.createdAt.getTime() - secondImage.createdAt.getTime();
}
