import { queryOptions } from '@tanstack/react-query';
import { getTenantList } from './service';

export const tenantsKeys = {
  all: ['tenants'] as const,
  list: (offset: number, limit: number) => [...tenantsKeys.all, 'list', offset, limit] as const
};

export const tenantsListOptions = (offset: number, limit: number) =>
  queryOptions({
    queryKey: tenantsKeys.list(offset, limit),
    queryFn: () => getTenantList(offset, limit),
    // Live refresh: the tenant list auto-updates when a status changes via the
    // data lane (mirrors the app-new products/document-request pattern). Polling
    // pauses while the tab is backgrounded; a focus regain forces a refetch.
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always'
  });
