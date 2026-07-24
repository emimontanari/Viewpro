import { queryOptions } from '@tanstack/react-query';
import { getAuditFeed } from './service';
import type { AuditFilters } from './types';

export const auditKeys = {
  all: ['audit'] as const,
  // audit-view (Slice 3, Phase 3) — filters join the query key so changing a
  // filter (Slice 4's filter bar) invalidates the cache and triggers a
  // refetch, matching adminActivityOptions/adminKeys.activity's filter-in-key
  // pattern (design D9). Defaults to {} so existing callers are unaffected.
  list: (offset: number, limit: number, filters: AuditFilters = {}) =>
    [...auditKeys.all, 'list', offset, limit, filters] as const
};

export const auditFeedOptions = (offset: number, limit: number, filters: AuditFilters = {}) =>
  queryOptions({
    queryKey: auditKeys.list(offset, limit, filters),
    queryFn: () => getAuditFeed(offset, limit, filters),
    // Live refresh so the audit feed picks up new entries as they are recorded.
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always'
  });
