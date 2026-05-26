import type { ActivityFeedItem } from '@/features/activity/api/types';
import type {
  ProductAgent,
  PropertyEngagementStatus,
  PropertyOperationType
} from '@/features/products/api/types';

export const dashboardSummaryRanges = ['7d', '14d', '30d'] as const;

export type DashboardSummaryRange = (typeof dashboardSummaryRanges)[number];

export type DashboardSummaryFilters = {
  range?: DashboardSummaryRange;
  tenantId?: string | null;
};

export type DashboardSummaryTopProperty = {
  engagementId: string;
  propertyId: string;
  title: string | null;
  addressLine: string | null;
  city: string | null;
  province: string | null;
  status: PropertyEngagementStatus;
  operationType: PropertyOperationType;
  agents: ProductAgent[];
  movementCount: number;
  documentRequestCount: number;
  lastActivityAt: string;
  lastActivityTitle: string;
};

export type DashboardSummaryTopSeller = {
  userId: string;
  name: string;
  email: string;
  movementCount: number;
  touchedPropertiesCount: number;
  lastMovementAt: string;
};

export type DashboardSummaryResponse = {
  range: {
    preset: DashboardSummaryRange;
    from: string;
    to: string;
  };
  counters: {
    activeProperties: number;
    movementsInRange: number;
    staleProperties: number;
    attentionNeeded: number;
  };
  recentActivity: ActivityFeedItem[];
  topProperties: DashboardSummaryTopProperty[];
  topSellers: DashboardSummaryTopSeller[];
};
