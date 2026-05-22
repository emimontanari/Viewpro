import { queryOptions } from '@tanstack/react-query';
import { getActivityFeed } from './service';
import type { ActivityFeedFilters } from './types';

export const activityKeys = {
  all: ['activity'] as const,
  feed: (filters: ActivityFeedFilters) => [...activityKeys.all, 'feed', filters] as const
};

export const activityFeedOptions = (filters: ActivityFeedFilters) =>
  queryOptions({
    queryKey: activityKeys.feed(filters),
    queryFn: () => getActivityFeed(filters)
  });
