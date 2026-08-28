import { bffRequest } from '@/lib/bff-client';
import type { DashboardSummaryFilters, DashboardSummaryResponse } from './types';

const DASHBOARD_SUMMARY_API_PATH = '/api/dashboard/summary';
const DASHBOARD_REQUEST_TIMEOUT_MS = 10_000;

export async function getDashboardSummary(
  filters: DashboardSummaryFilters
): Promise<DashboardSummaryResponse> {
  return bffRequest<DashboardSummaryResponse>(buildDashboardSummaryUrl(filters), {}, { timeoutMs: DASHBOARD_REQUEST_TIMEOUT_MS });
}

function buildDashboardSummaryUrl(filters: DashboardSummaryFilters) {
  const searchParams = new URLSearchParams();

  appendSearchParam(searchParams, 'range', filters.range);

  const query = searchParams.toString();
  return query ? `${DASHBOARD_SUMMARY_API_PATH}?${query}` : DASHBOARD_SUMMARY_API_PATH;
}

function appendSearchParam(searchParams: URLSearchParams, key: string, value: string | undefined) {
  if (value === undefined || value === '') {
    return;
  }

  searchParams.set(key, value);
}
