import type { PropertyAssetImage } from '@prisma/client'
import type { PropertyEngagementWithDetails } from '../property-engagements.repository'
import { buildPropertyImageUrl } from '../property-images.storage'

export type PropertyImageResponse = ReturnType<typeof mapPropertyImage>
export type PropertyEngagementResponse = ReturnType<typeof mapPropertyEngagement>

export function mapPropertyEngagement(engagement: PropertyEngagementWithDetails) {
  const propertyImages = engagement.propertyAsset.images ?? []
  const images = propertyImages.map(mapPropertyImage)
  const primaryImage = images.find((image) => image.isPrimary) ?? images[0] ?? null

  return {
    id: engagement.id,
    tenantId: engagement.tenantId,
    operationType: engagement.operationType,
    status: engagement.status,
    publishedPriceCents: engagement.publishedPriceCents,
    currency: engagement.currency,
    property: {
      id: engagement.propertyAsset.id,
      title: engagement.propertyAsset.title,
      addressLine: engagement.propertyAsset.addressLine,
      city: engagement.propertyAsset.city,
      province: engagement.propertyAsset.province,
      propertyType: engagement.propertyAsset.propertyType,
      totalAreaSqm: engagement.propertyAsset.totalAreaSqm,
      coveredAreaSqm: engagement.propertyAsset.coveredAreaSqm,
      rooms: engagement.propertyAsset.rooms,
      bedrooms: engagement.propertyAsset.bedrooms,
      bathrooms: engagement.propertyAsset.bathrooms,
      garages: engagement.propertyAsset.garages,
      ageYears: engagement.propertyAsset.ageYears,
      orientation: engagement.propertyAsset.orientation,
      ownerName: engagement.propertyAsset.ownerName,
      ownerEmail: engagement.propertyAsset.ownerEmail,
      images,
      primaryImage,
    },
    agents: engagement.agents.map((agent) => ({
      id: agent.id,
      userId: agent.agentUserId,
      email: agent.agentUser.email,
      firstName: agent.agentUser.firstName,
    })),
    createdAt: engagement.createdAt.toISOString(),
    updatedAt: engagement.updatedAt.toISOString(),
  }
}


export function mapPropertyImage(image: PropertyAssetImage) {
  return {
    id: image.id,
    storageKey: image.storageKey,
    url: buildPropertyImageUrl(image.storageKey),
    originalFilename: image.originalFilename,
    mimeType: image.mimeType,
    sizeBytes: image.sizeBytes,
    isPrimary: image.isPrimary,
    createdAt: image.createdAt.toISOString(),
    updatedAt: image.updatedAt.toISOString(),
  }
}
