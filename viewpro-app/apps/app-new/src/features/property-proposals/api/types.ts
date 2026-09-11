export type PropertyProposalStatus = 'BORRADOR' | 'EN_REVISION' | 'APROBADA' | 'RECHAZADA';
export type PropertyProposalReviewOutcome = 'APPROVED' | 'REJECTED';
export type PropertyProposalHistoryFilter = 'NONE' | 'PENDING' | PropertyProposalReviewOutcome;
export type PropertyType = 'HOUSE' | 'APARTMENT' | 'LAND' | 'COMMERCIAL' | 'OTHER';
export type PropertyOperationType = 'SALE' | 'RENT';

export type PropertyProposalFields = {
  title: string;
  addressLine?: string | null;
  city?: string | null;
  province?: string | null;
  propertyType?: PropertyType | null;
  operationType?: PropertyOperationType | null;
  totalAreaSqm?: number | null;
  coveredAreaSqm?: number | null;
  rooms?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  garages?: number | null;
  ageYears?: number | null;
  orientation?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  publishedPriceCents?: number | null;
  currency?: string | null;
};

export type PropertyProposalSnapshot = {
  title: string | null;
  addressLine: string | null;
  city: string | null;
  province: string | null;
  propertyType: PropertyType | null;
  operationType: PropertyOperationType | null;
  totalAreaSqm: number | null;
  coveredAreaSqm: number | null;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  garages: number | null;
  ageYears: number | null;
  orientation: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  publishedPriceCents: number | null;
  currency: string | null;
};

export type PropertyProposalPerson = { id: string; firstName: string; lastName: string | null };
export type PropertyProposalDecision = {
  outcome: PropertyProposalReviewOutcome;
  decidedAt: string;
  rejectionReason: string | null;
  reviewer: PropertyProposalPerson;
};
export type PropertyProposalHistory = {
  id: string;
  roundNumber: number;
  submittedAt: string;
  submittedBy: PropertyProposalPerson;
  snapshot: PropertyProposalSnapshot;
  decision: PropertyProposalDecision | null;
};

export type SellerPropertyProposalSummary = {
  id: string;
  state: PropertyProposalStatus;
  version: number;
  title: string;
  currentReviewRoundId?: string;
  canonicalEngagementId?: string;
  latestSubmittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type SellerPropertyProposalDetail = SellerPropertyProposalSummary & Required<PropertyProposalFields> & {
  history: PropertyProposalHistory[];
};
export type ReviewerPropertyProposalSummary = SellerPropertyProposalSummary & { proposedBy: PropertyProposalPerson };
export type ReviewerPropertyProposalDetail = SellerPropertyProposalDetail & { proposedBy: PropertyProposalPerson };
export type PropertyProposalPage<T> = { items: T[]; total: number; page: number; pageSize: number };
export type SellerPropertyProposalsPage = PropertyProposalPage<SellerPropertyProposalSummary>;
export type ReviewerPropertyProposalsPage = PropertyProposalPage<ReviewerPropertyProposalSummary>;

export type CreatePropertyProposalPayload = PropertyProposalFields;
export type UpdatePropertyProposalPayload = Partial<PropertyProposalFields> & { expectedVersion: number };
export type SubmitPropertyProposalPayload = { expectedVersion: number };
export type ReviewPropertyProposalPayload = { reviewRoundId: string };
export type RejectPropertyProposalPayload = ReviewPropertyProposalPayload & { reason?: unknown };
export type SellerPropertyProposalFilters = { page?: number; pageSize?: number };
export type ReviewerPropertyProposalFilters = {
  state?: PropertyProposalStatus;
  history?: PropertyProposalHistoryFilter;
  page?: number;
  pageSize?: number;
};
