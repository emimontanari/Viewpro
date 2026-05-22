'use client';

import { useSelectedTenantId } from '@/lib/tenant-selection';
import { useQuery } from '@tanstack/react-query';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { assignableProductAgentsOptions } from '@/features/products/api/queries';
import type { ProductMovementType } from '@/features/products/api/types';
import { movementTypeLabels } from '@/features/products/constants/movement-options';
import { activityFeedOptions } from '../api/queries';
import type { ActivityFeedFilters } from '../api/types';
import { ActivityFeed } from './activity-feed';
import { ActivityFilters } from './activity-filters';
import { ActivityKpiCards } from './activity-kpi-cards';

const PAGE_SIZE = 20;

export function ActivityMonitor() {
  const selectedTenantId = useSelectedTenantId();
  const [params, setParams] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    type: parseAsString,
    sellerId: parseAsString,
    dateFrom: parseAsString,
    dateTo: parseAsString
  });

  const type = isProductMovementType(params.type) ? params.type : undefined;
  const filters: ActivityFeedFilters = {
    page: params.page,
    pageSize: PAGE_SIZE,
    tenantId: selectedTenantId,
    ...(type && { type }),
    ...(params.sellerId && { sellerId: params.sellerId }),
    ...(params.dateFrom && { dateFrom: params.dateFrom }),
    ...(params.dateTo && { dateTo: params.dateTo })
  };

  const activityQuery = useQuery({
    ...activityFeedOptions(filters),
    enabled: Boolean(selectedTenantId)
  });
  const agentsQuery = useQuery({
    ...assignableProductAgentsOptions(selectedTenantId),
    enabled: Boolean(selectedTenantId)
  });

  const total = activityQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(type || params.sellerId || params.dateFrom || params.dateTo);

  const updateFilters = (nextFilters: {
    type?: ProductMovementType | null;
    sellerId?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  }) => {
    void setParams({ ...nextFilters, page: 1 });
  };

  const clearFilters = () => {
    void setParams({ dateFrom: null, dateTo: null, page: 1, sellerId: null, type: null });
  };

  const setPage = (page: number) => {
    void setParams({ page: Math.min(Math.max(page, 1), pageCount) });
  };

  if (!selectedTenantId) {
    return (
      <ActivityMessage
        title='Seleccioná una inmobiliaria'
        description='Elegí una inmobiliaria para ver el seguimiento operativo de sus propiedades.'
      />
    );
  }

  return (
    <section className='min-w-0 space-y-5'>
      <ActivityKpiCards
        counters={activityQuery.data?.counters}
        isLoading={activityQuery.isLoading}
      />

      <ActivityFilters
        assignableAgents={agentsQuery.data?.items ?? []}
        dateFrom={params.dateFrom}
        dateTo={params.dateTo}
        hasFilters={hasFilters}
        isLoadingAgents={agentsQuery.isLoading}
        sellerId={params.sellerId}
        type={type}
        onClearFilters={clearFilters}
        onDateFromChange={(dateFrom) => updateFilters({ dateFrom })}
        onDateToChange={(dateTo) => updateFilters({ dateTo })}
        onSellerChange={(sellerId) => updateFilters({ sellerId })}
        onTypeChange={(nextType) => updateFilters({ type: nextType })}
      />

      <ActivityFeed
        isError={activityQuery.isError}
        isFetching={activityQuery.isFetching}
        isLoading={activityQuery.isLoading}
        items={activityQuery.data?.items ?? []}
        page={params.page}
        pageCount={pageCount}
        total={total}
        onPageChange={setPage}
        onRetry={() => void activityQuery.refetch()}
      />
    </section>
  );
}

function ActivityMessage({ description, title }: { description: string; title: string }) {
  return (
    <div className='rounded-2xl border bg-card p-6 text-center shadow-xs'>
      <h2 className='text-base font-semibold'>{title}</h2>
      <p className='mx-auto mt-2 max-w-xl text-sm text-muted-foreground'>{description}</p>
    </div>
  );
}

function isProductMovementType(value: string | null): value is ProductMovementType {
  return Boolean(value && value in movementTypeLabels);
}
