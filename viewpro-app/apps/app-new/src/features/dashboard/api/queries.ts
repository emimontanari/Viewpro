import { queryOptions } from '@tanstack/react-query';
import { getDashboardSummary } from './service';
import type { DashboardSummaryFilters } from './types';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: (filters: DashboardSummaryFilters) =>
    [...dashboardKeys.all, 'summary', filters.tenantId ?? 'no-tenant', filters.range ?? '7d'] as const
};

export const dashboardSummaryOptions = (filters: DashboardSummaryFilters) =>
  queryOptions({
    queryKey: dashboardKeys.summary(filters),
    queryFn: () => getDashboardSummary(filters)
  });
