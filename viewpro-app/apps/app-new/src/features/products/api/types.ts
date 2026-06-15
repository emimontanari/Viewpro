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

export type TenantMemberRole = 'PRINCIPAL_MANAGER' | 'MANAGER' | 'AGENT';

export type ProductAgent = {
  id: string;
  userId: string;
  email: string;
  firstName: string | null;
};

export type AssignableProductAgent = {
  userId: string;
  email: string;
  firstName: string | null;
  role: TenantMemberRole;
};

export type AssignableProductAgentsResponse = {
  items: AssignableProductAgent[];
};

export type ProductAgentAssignmentPayload = {
  agentUserId: string;
};

export type RemoveProductAgentResponse = {
  deleted: true;
  id: string;
};

export type PropertyOwnerAccessStatus = 'INVITED' | 'ACTIVE' | 'REVOKED';

export type PropertyLinkedOwner = {
  id: string;
  userId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  ownerFirstName: string;
  ownerLastName: string;
  isPrimary: boolean;
  accessStatus: PropertyOwnerAccessStatus;
};

export type LinkProductOwnerPayload = {
  firstName: string;
  lastName: string;
  email: string;
};

export type LinkProductOwnerResponse = PropertyLinkedOwner & {
  propertyAssetId: string;
  createdAt: string;
  updatedAt: string;
};

export type ProductOwnerInvitationLinkResponse = {
  invitationId: string;
  propertyAssetOwnerId: string;
  email: string;
  expiresAt: string;
  invitationUrl: string;
};

export type ProductOwnerInvitationRevokeResponse = {
  propertyAssetOwnerId: string;
  revokedInvitationIds: string[];
  revokedCount: number;
};

export type ProductDocumentRequestStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type ProductDocumentVersionStatus = 'PENDING_UPLOAD' | 'UPLOADED' | 'APPROVED' | 'REJECTED';

export type ProductDocumentVersion = {
  id: string;
  documentId: string;
  uploadedByUserId: string;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string | null;
  status: ProductDocumentVersionStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProductSignedStorageUrl = {
  url: string;
  storageKey: string;
  expiresInSeconds: number;
};

export type ProductDocumentVersionUrlResponse = {
  version: ProductDocumentVersion;
  readUrl: ProductSignedStorageUrl;
};

export type RejectProductDocumentRequestPayload = {
  reason: string;
};

export type ProductDocumentRequest = {
  id: string;
  tenantId: string;
  propertyEngagementId: string;
  propertyAssetOwnerId: string | null;
  ownerUserId: string | null;
  requestedByUserId: string;
  title: string;
  description: string | null;
  status: ProductDocumentRequestStatus;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  currentVersion: ProductDocumentVersion | null;
  versions: ProductDocumentVersion[];
};

export type ProductDocumentRequestsResponse = {
  items: ProductDocumentRequest[];
  total: number;
  page: number;
  pageSize: number;
};

export type CreateProductDocumentRequestPayload = {
  propertyAssetOwnerId: string;
  title: string;
  description?: string;
};

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
    owners: PropertyLinkedOwner[];
    images: PropertyImage[];
    primaryImage: PropertyImage | null;
  };
  agents: ProductAgent[];
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
  builtInOutcome: MovementBuiltInOutcome | null;
  customOutcomeLabel: ProductMovementCustomOutcomeLabel | null;
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

export type MovementBuiltInOutcome =
  | 'EN_CAPTACION'
  | 'DOCUMENTACION_PENDIENTE'
  | 'PREPARANDO_PUBLICACION'
  | 'PUBLICACION_ACTIVA'
  | 'CONSULTAS_Y_VISITAS'
  | 'NEGOCIACION_OFERTA'
  | 'RESERVA_INICIADA'
  | 'DOCUMENTACION_FINAL'
  | 'CERRADO'
  | 'CANCELADO';

export type MovementOutcome =
  | { builtIn: MovementBuiltInOutcome }
  | { customLabelId: string };

export type MovementOutcomeLabelDto = {
  id: string;
  tenantId: string;
  label: string;
  color: string | null;
  createdByUserId: string;
  createdAt: string;
  deletedAt: string | null;
};

export type CreateLabelPayload = {
  label: string;
  color?: string;
};

export type ProductMovementMutationPayload = {
  type: ManualProductMovementType;
  observation: string;
  nextStep?: string;
  newStatus?: PropertyEngagementStatus;
  outcome?: MovementOutcome;
};

export type ProductMovementCustomOutcomeLabel = {
  id: string;
  label: string;
  color: string | null;
  deletedAt: string | null;
};
