import { queryOptions } from '@tanstack/react-query';
import { getTenantDetail, getTenantList } from './service';

export const tenantsKeys = {
  all: ['tenants'] as const,
  list: (offset: number, limit: number) => [...tenantsKeys.all, 'list', offset, limit] as const,
  detail: (tenantId: string, offset: number, limit: number) =>
    [...tenantsKeys.all, 'detail', tenantId, offset, limit] as const
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

/**
 * Tenant detail summary (counts + first activity page) query options
 * (platform-tenant-tracking, D9/D11). No live-refresh polling — the detail
 * page is on-demand and read-only; subsequent "Cargar más" pages are fetched
 * directly via getTenantDetail (not through this query), so they never
 * re-trigger a counts refetch.
 */
export const tenantDetailOptions = (tenantId: string, offset: number, limit: number) =>
  queryOptions({
    queryKey: tenantsKeys.detail(tenantId, offset, limit),
    queryFn: () => getTenantDetail(tenantId, offset, limit)
  });
