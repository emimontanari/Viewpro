import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { activityFeedOptions } from '@/features/activity/api/queries';
import type { ActivityFeedResponse } from '@/features/activity/api/types';
import { productsQueryOptions } from '@/features/products/api/queries';
import type { ProductsResponse } from '@/features/products/api/types';
import { PROPERTY_PREVIEW_SIZE, SELLER_ACTIVITY_PREVIEW_SIZE } from './constants';

export type SellerQuerySnapshot<T> = {
  data: T | undefined;
  isError: boolean;
  isFetching: boolean;
  isLoading: boolean;
  isSuccess: boolean;
  refetch: () => void;
};

export type SellerProductsState =
  | { status: 'loading'; tenantId: string }
  | { status: 'error'; tenantId: string; retry: () => void; retrying: boolean }
  | { status: 'ready'; tenantId: string; data: ProductsResponse }
  | { status: 'refreshing'; tenantId: string; data: ProductsResponse }
  | {
      status: 'retained-error';
      tenantId: string;
      data: ProductsResponse;
      retry: () => void;
      retrying: boolean;
    };

export type SellerActivityState =
  | { status: 'loading'; tenantId: string }
  | { status: 'error'; tenantId: string; retry: () => void; retrying: boolean }
  | { status: 'ready'; tenantId: string; data: ActivityFeedResponse }
  | { status: 'refreshing'; tenantId: string; data: ActivityFeedResponse }
  | {
      status: 'retained-error';
      tenantId: string;
      data: ActivityFeedResponse;
      retry: () => void;
      retrying: boolean;
    };

function isFiniteCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function hasValidProducts(data: ProductsResponse, tenantId: string) {
  return isFiniteCount(data.total) && data.items.every((item) => item.tenantId === tenantId);
}

function hasValidActivity(data: ActivityFeedResponse, tenantId: string) {
  if (!data.counters) return false;
  const { attentionCount, staleCount, todayCount } = data.counters;
  return (
    isFiniteCount(attentionCount) &&
    isFiniteCount(staleCount) &&
    isFiniteCount(todayCount) &&
    data.items.every(
      (item) => item.tenantId === tenantId && item.propertyEngagementId === item.property.engagementId
    )
  );
}

function toSellerState<T>(
  query: SellerQuerySnapshot<T>,
  tenantId: string,
  isValid: (data: T, tenantId: string) => boolean
) {
  if (query.data && isValid(query.data, tenantId)) {
    if (query.isError) {
      return { status: 'retained-error' as const, tenantId, data: query.data, retry: query.refetch, retrying: query.isFetching };
    }
    if (query.isFetching) return { status: 'refreshing' as const, tenantId, data: query.data };
    if (query.isSuccess) return { status: 'ready' as const, tenantId, data: query.data };
  }

  if (query.isLoading) return { status: 'loading' as const, tenantId };
  return { status: 'error' as const, tenantId, retry: query.refetch, retrying: query.isFetching };
}

export function toSellerProductsState(query: SellerQuerySnapshot<ProductsResponse>, tenantId: string): SellerProductsState {
  return toSellerState(query, tenantId, hasValidProducts);
}

export function toSellerActivityState(query: SellerQuerySnapshot<ActivityFeedResponse>, tenantId: string): SellerActivityState {
  return toSellerState(query, tenantId, hasValidActivity);
}

type SellerOperationalHomepageProps = {
  activeTenantId: string;
  children: (states: { activity: SellerActivityState; products: SellerProductsState }) => ReactNode;
  membershipId: string;
};

export function SellerOperationalHomepage({ activeTenantId, children, membershipId }: SellerOperationalHomepageProps) {
  return (
    <SellerOperationalHomepageQueryContainer key={`${membershipId}:${activeTenantId}`} activeTenantId={activeTenantId}>
      {children}
    </SellerOperationalHomepageQueryContainer>
  );
}

function SellerOperationalHomepageQueryContainer({ activeTenantId, children }: Omit<SellerOperationalHomepageProps, 'membershipId'>) {
  const productsQuery = useQuery({
    ...productsQueryOptions({ archived: 'active', limit: PROPERTY_PREVIEW_SIZE, page: 1, tenantId: activeTenantId }),
    enabled: Boolean(activeTenantId),
    refetchOnReconnect: false,
    refetchOnWindowFocus: false
  });
  const activityQuery = useQuery({
    ...activityFeedOptions({ kind: 'all', page: 1, pageSize: SELLER_ACTIVITY_PREVIEW_SIZE, tenantId: activeTenantId }),
    enabled: Boolean(activeTenantId),
    refetchOnReconnect: false,
    refetchOnWindowFocus: false
  });

  return children({
    activity: toSellerActivityState(activityQuery, activeTenantId),
    products: toSellerProductsState(productsQuery, activeTenantId)
  });
}
