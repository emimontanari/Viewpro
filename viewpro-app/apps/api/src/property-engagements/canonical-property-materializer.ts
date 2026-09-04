import { Injectable } from '@nestjs/common'
import { Prisma, PropertyEngagementStatus, PropertyOperationType, PropertyType } from '@prisma/client'

export type CanonicalPropertyMaterializerInput = {
  tenantId: string
  creatorUserId: string
  sourceProposalId?: string
  title: string
  addressLine: string
  city: string
  province: string
  propertyType: PropertyType
  operationType: PropertyOperationType
  totalAreaSqm: number | null
  coveredAreaSqm: number | null
  rooms: number | null
  bedrooms: number | null
  bathrooms: number | null
  garages: number | null
  ageYears: number | null
  orientation: string | null
  ownerName: string | null
  ownerEmail: string | null
  publishedPriceCents: number | null
  currency: string | null
  assignment?: { agentUserId: string; assignedByUserId: string }
}

@Injectable()
export class CanonicalPropertyMaterializer {
  async createInTransaction(
    tx: Prisma.TransactionClient,
    input: CanonicalPropertyMaterializerInput,
  ) {
    const asset = await tx.propertyAsset.create({
      data: {
        title: input.title,
        addressLine: input.addressLine,
        city: input.city,
        province: input.province,
        propertyType: input.propertyType,
        totalAreaSqm: input.totalAreaSqm,
        coveredAreaSqm: input.coveredAreaSqm,
        rooms: input.rooms,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        garages: input.garages,
        ageYears: input.ageYears,
        orientation: input.orientation,
        ownerName: input.ownerName,
        ownerEmail: input.ownerEmail,
        createdByUserId: input.creatorUserId,
      },
    })
    const engagementData: Prisma.PropertyEngagementUncheckedCreateInput = {
      tenantId: input.tenantId,
      propertyAssetId: asset.id,
      createdByUserId: input.creatorUserId,
      operationType: input.operationType,
      publishedPriceCents: input.publishedPriceCents,
      status: PropertyEngagementStatus.CAPTURE,
    }
    if (input.sourceProposalId) {
      engagementData.sourceProposalId = input.sourceProposalId
    }
    if (input.currency !== null) {
      engagementData.currency = input.currency
    }
    const engagement = await tx.propertyEngagement.create({ data: engagementData })
    const assignment = input.assignment
      ? await tx.propertyAgent.create({
          data: {
            tenantId: input.tenantId,
            propertyEngagementId: engagement.id,
            agentUserId: input.assignment.agentUserId,
            assignedByUserId: input.assignment.assignedByUserId,
            isPrimary: false,
          },
        })
      : null

    return { asset, engagement, assignment }
  }
}
