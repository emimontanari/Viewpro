import type {
  ProductAgent,
  ProductDocumentRequestStatus,
  ProductDocumentVersionStatus,
  ProductMovementInterestLevel,
  ProductMovementSource,
  ProductMovementType,
  PropertyEngagementStatus,
  PropertyOperationType,
  PropertyOwnerAccessStatus
} from '@/features/products/api/types';

export type ActivityFeedCounters = {
  todayCount: number;
  staleCount: number;
  attentionCount: number;
};

export type ActivityKindFilter = 'all' | 'movement' | 'document_request';

export type ActivityPropertySummary = {
  id: string;
  engagementId: string;
  assetId: string;
  title: string | null;
  addressLine: string | null;
  city: string | null;
  province: string | null;
  operationType: PropertyOperationType;
  status: PropertyEngagementStatus;
  agents: ProductAgent[];
};

export type ActivityMovementItem = {
  kind: 'movement';
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
  property: ActivityPropertySummary;
};

export type ActivityDocumentRequestItem = {
  kind: 'document_request';
  id: string;
  tenantId: string;
  propertyEngagementId: string;
  documentRequestId: string;
  createdAt: string;
  property: ActivityPropertySummary;
  owner: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    ownerFirstName: string;
    ownerLastName: string;
    accessStatus: PropertyOwnerAccessStatus;
  } | null;
  requestedBy: {
    id: string;
    email: string;
    firstName: string | null;
  };
  documentRequest: {
    title: string;
    description: string | null;
    status: ProductDocumentRequestStatus;
    currentVersion: {
      id: string;
      originalFilename: string;
      status: ProductDocumentVersionStatus;
      createdAt: string;
    } | null;
  };
};

export type ActivityFeedItem = ActivityMovementItem | ActivityDocumentRequestItem;

export type ActivityFeedResponse = {
  total: number;
  page: number;
  pageSize: number;
  counters: ActivityFeedCounters;
  items: ActivityFeedItem[];
};

export type ActivityFeedFilters = {
  page?: number;
  pageSize?: number;
  kind?: ActivityKindFilter;
  type?: ProductMovementType;
  sellerId?: string;
  dateFrom?: string;
  dateTo?: string;
  tenantId?: string | null;
};
