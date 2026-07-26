import { queryOptions } from '@tanstack/react-query';
import { getRevenueSummary, getTenantPayments } from './service';

export const paymentKeys = {
  all: ['payments'] as const,
  byTenant: (tenantId: string) => [...paymentKeys.all, 'tenant', tenantId] as const,
  revenue: () => [...paymentKeys.all, 'revenue'] as const
};

export const tenantPaymentsOptions = (tenantId: string) =>
  queryOptions({
    queryKey: paymentKeys.byTenant(tenantId),
    queryFn: () => getTenantPayments(tenantId)
  });

export const revenueSummaryOptions = queryOptions({
  queryKey: paymentKeys.revenue(),
  queryFn: getRevenueSummary
});
