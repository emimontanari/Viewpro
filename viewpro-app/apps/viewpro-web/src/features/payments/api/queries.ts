import { queryOptions } from '@tanstack/react-query';
import { getTenantPayments } from './service';

export const paymentKeys = {
  all: ['payments'] as const,
  byTenant: (tenantId: string) => [...paymentKeys.all, 'tenant', tenantId] as const
};

export const tenantPaymentsOptions = (tenantId: string) =>
  queryOptions({
    queryKey: paymentKeys.byTenant(tenantId),
    queryFn: () => getTenantPayments(tenantId)
  });
