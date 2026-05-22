export type PropertyOperationType = 'SALE' | 'RENT';

export type PropertyType = 'HOUSE' | 'APARTMENT' | 'LAND' | 'COMMERCIAL' | 'OTHER';

export type PropertyEngagementStatus =
  | 'CAPTURE'
  | 'DOCUMENTATION_PENDING'
  | 'PUBLICATION_PREPARATION'
  | 'ACTIVE_PUBLICATION'
  | 'INQUIRIES_AND_VISITS'
  | 'OFFER_NEGOTIATION'
  | 'RESERVATION_STARTED'
  | 'FINAL_DOCUMENTATION'
  | 'CLOSED'
  | 'CANCELLED';

export type ProductMovementType =
  | 'GENERAL_UPDATE'
  | 'INQUIRY'
  | 'VISIT_SCHEDULED'
  | 'VISIT_COMPLETED'
  | 'OFFER_RECEIVED'
  | 'DOCUMENTATION_UPDATE'
  | 'STATUS_CHANGE'
  | 'ARCHIVED'
  | 'RESTORED';

export type ManualProductMovementType = Exclude<ProductMovementType, 'ARCHIVED' | 'RESTORED'>;

export type ProductMovementSource = 'MANUAL' | 'SYSTEM';

export type ProductMovementInterestLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type PropertyArchiveFilter = 'active' | 'archived' | 'all';

export type PropertyImage = {
  id: string;
  storageKey: string;
  url: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PropertyEngagement = {
  id: string;
  tenantId: string;
  operationType: PropertyOperationType;
  status: PropertyEngagementStatus;
  publishedPriceCents: number | null;
  currency: string | null;
  archivedAt: string | null;
  archivedByUserId: string | null;
  archiveReason: string | null;
  property: {
    id: string;
    title: string;
    addressLine: string;
    city: string;
    province: string;
    propertyType: PropertyType;
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
    images: PropertyImage[];
    primaryImage: PropertyImage | null;
  };
  agents: Array<{
    id: string;
    userId: string;
    email: string;
    firstName: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type ApiErrorResponse = {
  statusCode: number;
  error: string;
  message: string | string[];
  path?: string;
  timestamp?: string;
  requestId?: string;
};

// Temporary aliases while `/dashboard/product` and product-named modules are migrated.
export type Product = PropertyEngagement;

export type ProductFilters = {
  page?: number;
  limit?: number;
  operationType?: string;
  status?: string;
  archived?: PropertyArchiveFilter;
  tenantId?: string | null;
};

export type ProductsResponse = {
  items: PropertyEngagement[];
  total: number;
  page: number;
  pageSize: number;
};

export type ProductMovement = {
  id: string;
  tenantId: string;
  propertyEngagementId: string;
  type: ProductMovementType;
  observation: string;
  nextStep: string | null;
  previousStatus: PropertyEngagementStatus | null;
  newStatus: PropertyEngagementStatus | null;
  source: ProductMovementSource;
  interestCount: number | null;
  visitCount: number | null;
  offerAmountCents: number | null;
  interestLevel: ProductMovementInterestLevel | null;
  createdBy: {
    id: string;
    email: string;
    firstName: string | null;
  };
  createdAt: string;
};

export type ProductMovementsResponse = {
  items: ProductMovement[];
  total: number;
  page: number;
  pageSize: number;
};

export type ProductByIdResponse = PropertyEngagement | ApiErrorResponse;

export type ProductMutationPayload = {
  title: string;
  addressLine: string;
  city: string;
  province: string;
  propertyType: PropertyType;
  ownerName?: string | null;
  ownerEmail?: string | null;
  operationType: PropertyOperationType;
  publishedPriceCents?: number | null;
  currency?: string;
  totalAreaSqm?: number | null;
  coveredAreaSqm?: number | null;
  rooms?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  garages?: number | null;
  ageYears?: number | null;
  orientation?: string | null;
};

export type ProductStatusMutationPayload = {
  previousStatus?: PropertyEngagementStatus;
  status: PropertyEngagementStatus;
};

export type ProductMovementMutationPayload = {
  type: ManualProductMovementType;
  observation: string;
  nextStep?: string;
  newStatus?: PropertyEngagementStatus;
};
