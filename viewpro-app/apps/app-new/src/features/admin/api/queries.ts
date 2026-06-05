import { queryOptions } from '@tanstack/react-query';
import { getAdminDashboardData, listAdminActivity, listAdminTenants } from './service';
import type { ListAdminActivityInput, ListAdminTenantsInput } from './types';

export const adminKeys = {
  all: ['admin'] as const,
  dashboard: () => [...adminKeys.all, 'dashboard'] as const,
  tenants: (filters: ListAdminTenantsInput) =>
    [...adminKeys.all, 'tenants', filters.page, filters.pageSize, filters.status || 'all'] as const,
  activity: (filters: ListAdminActivityInput) =>
    [
      ...adminKeys.all,
      'activity',
      filters.page,
      filters.pageSize,
      filters.tenantId || 'all'
    ] as const
};

export const adminDashboardOptions = () =>
  queryOptions({
    queryKey: adminKeys.dashboard(),
    queryFn: getAdminDashboardData
  });

export const adminTenantsOptions = (filters: ListAdminTenantsInput) =>
  queryOptions({
    queryKey: adminKeys.tenants(filters),
    queryFn: () => listAdminTenants(filters)
  });

export const adminActivityOptions = (filters: ListAdminActivityInput) =>
  queryOptions({
    queryKey: adminKeys.activity(filters),
    queryFn: () => listAdminActivity(filters)
  });
