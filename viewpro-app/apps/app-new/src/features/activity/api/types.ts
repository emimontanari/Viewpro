import type {
  ProductAgent,
  ProductMovementInterestLevel,
  ProductMovementSource,
  ProductMovementType,
  PropertyEngagementStatus,
  PropertyOperationType
} from '@/features/products/api/types';

export type ActivityFeedCounters = {
  todayCount: number;
  staleCount: number;
  attentionCount: number;
};

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

export type ActivityFeedItem = {
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
  type?: ProductMovementType;
  sellerId?: string;
  dateFrom?: string;
  dateTo?: string;
  tenantId?: string | null;
};
