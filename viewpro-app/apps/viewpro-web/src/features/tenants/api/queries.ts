import { queryOptions } from '@tanstack/react-query';
import { getTenantList } from './service';

export const tenantsKeys = {
  all: ['tenants'] as const,
  list: (offset: number, limit: number) => [...tenantsKeys.all, 'list', offset, limit] as const
};

export const tenantsListOptions = (offset: number, limit: number) =>
  queryOptions({
    queryKey: tenantsKeys.list(offset, limit),
    queryFn: () => getTenantList(offset, limit)
  });
