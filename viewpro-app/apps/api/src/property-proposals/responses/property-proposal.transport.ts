import type { ProposalResultLink } from './property-proposal.response'

export type PropertyProposalTransportInput = {
  id: string
  state: string
  version: number
  title: string
  addressLine: string | null
  city: string | null
  province: string | null
  propertyType: string | null
  operationType: string | null
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
  latestSubmittedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type PropertyProposalTransport = PropertyProposalTransportInput & ProposalResultLink

export type PropertyProposalSummaryTransport = Pick<PropertyProposalTransportInput,
  'id' | 'state' | 'version' | 'title' | 'latestSubmittedAt' | 'createdAt' | 'updatedAt'
> & { currentReviewRoundId?: string } & ProposalResultLink

export function mapPropertyProposalSummaryTransport(
  proposal: PropertyProposalTransportInput,
  currentReviewRoundId: string | undefined,
  resultLink: ProposalResultLink,
): PropertyProposalSummaryTransport {
  const transport: PropertyProposalSummaryTransport = {
    id: proposal.id,
    state: proposal.state,
    version: proposal.version,
    title: proposal.title,
    latestSubmittedAt: proposal.latestSubmittedAt,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
  }
  if (typeof currentReviewRoundId === 'string' && currentReviewRoundId.length > 0) {
    transport.currentReviewRoundId = currentReviewRoundId
  }
  if (typeof resultLink.canonicalEngagementId === 'string' && resultLink.canonicalEngagementId.length > 0) {
    transport.canonicalEngagementId = resultLink.canonicalEngagementId
  }
  return transport
}

export function mapPropertyProposalTransport(
  proposal: PropertyProposalTransportInput,
  resultLink?: ProposalResultLink,
): PropertyProposalTransport {
  const transport: PropertyProposalTransport = {
    id: proposal.id,
    state: proposal.state,
    version: proposal.version,
    title: proposal.title,
    addressLine: proposal.addressLine,
    city: proposal.city,
    province: proposal.province,
    propertyType: proposal.propertyType,
    operationType: proposal.operationType,
    totalAreaSqm: proposal.totalAreaSqm,
    coveredAreaSqm: proposal.coveredAreaSqm,
    rooms: proposal.rooms,
    bedrooms: proposal.bedrooms,
    bathrooms: proposal.bathrooms,
    garages: proposal.garages,
    ageYears: proposal.ageYears,
    orientation: proposal.orientation,
    ownerName: proposal.ownerName,
    ownerEmail: proposal.ownerEmail,
    publishedPriceCents: proposal.publishedPriceCents,
    currency: proposal.currency,
    latestSubmittedAt: proposal.latestSubmittedAt,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
  }

  const canonicalEngagementId = resultLink?.canonicalEngagementId
  if (typeof canonicalEngagementId === 'string' && canonicalEngagementId.length > 0) {
    transport.canonicalEngagementId = canonicalEngagementId
  }

  return transport
}
