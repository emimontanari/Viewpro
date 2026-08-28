import { bffRequest } from '@/lib/bff-client';
import type { ActivityFeedFilters, ActivityFeedResponse } from './types';

const ACTIVITY_FEED_API_PATH = '/api/activity/feed';
const ACTIVITY_REQUEST_TIMEOUT_MS = 10_000;

export async function getActivityFeed(filters: ActivityFeedFilters): Promise<ActivityFeedResponse> {
  return bffRequest<ActivityFeedResponse>(
    buildActivityFeedUrl(filters),
    {},
    { timeoutMs: ACTIVITY_REQUEST_TIMEOUT_MS }
  );
}

function buildActivityFeedUrl(filters: ActivityFeedFilters) {
  const searchParams = new URLSearchParams();

  appendSearchParam(searchParams, 'page', filters.page);
  appendSearchParam(searchParams, 'pageSize', filters.pageSize);
  appendSearchParam(searchParams, 'kind', filters.kind === 'all' ? undefined : filters.kind);
  appendSearchParam(searchParams, 'type', filters.type);
  appendSearchParam(searchParams, 'sellerId', filters.sellerId);
  appendSearchParam(searchParams, 'dateFrom', filters.dateFrom);
  appendSearchParam(searchParams, 'dateTo', filters.dateTo);

  const query = searchParams.toString();
  return query ? `${ACTIVITY_FEED_API_PATH}?${query}` : ACTIVITY_FEED_API_PATH;
}

function appendSearchParam(
  searchParams: URLSearchParams,
  key: string,
  value: number | string | undefined
) {
  if (value === undefined || value === '') {
    return;
  }

  searchParams.set(key, String(value));
}
