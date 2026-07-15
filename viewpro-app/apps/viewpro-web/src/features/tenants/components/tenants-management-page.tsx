'use client';

// PR1 (WU-1): list query + loading/empty/error/pager only — no mutations yet.
// Mutations, dialogs, and status confirm are added in T-17 (WU-2).
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { tenantsListOptions } from '@/features/tenants/api/queries';
import { getApiErrorMessage } from '@/lib/api-client';
import { TenantsEmptyState } from './tenants-empty-state';
import { TenantsPager } from './tenants-pager';
import { TenantsTable } from './tenants-table';

const LIMIT = 50;

function TenantsLoadingSkeleton() {
  return (
    <div data-testid='tenants-loading-skeleton' className='flex flex-col gap-3'>
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className='h-12 w-full rounded-xl' />
      ))}
    </div>
  );
}

export function TenantsManagementPage() {
  const [offset, setOffset] = React.useState(0);

  const { data, isLoading, isError, error } = useQuery({
    ...tenantsListOptions(offset, LIMIT),
    retry: false
  });

  const handlePrev = React.useCallback(() => {
    setOffset((current) => Math.max(0, current - LIMIT));
  }, []);

  const handleNext = React.useCallback(() => {
    setOffset((current) => (data && current + LIMIT < data.total ? current + LIMIT : current));
  }, [data]);

  if (isLoading) {
    return <TenantsLoadingSkeleton />;
  }

  if (isError) {
    return (
      <div
        data-testid='tenants-error'
        className='border-destructive/30 bg-destructive/5 rounded-xl border p-6'
      >
        <p className='text-destructive font-semibold'>No se pudieron cargar los inquilinos</p>
        <p className='text-muted-foreground mt-1 text-sm'>{getApiErrorMessage(error)}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  if (data.total === 0) {
    return <TenantsEmptyState />;
  }

  return (
    <div className='flex flex-col gap-4'>
      {/* isMutating/onEditLimits/onToggleStatus are wired to real mutations in T-17;
          this interim no-op wiring only keeps the tree building after T-13's
          actions column lands ahead of the container's mutation logic. */}
      <TenantsTable
        items={data.items}
        isMutating={false}
        onEditLimits={() => {}}
        onToggleStatus={() => {}}
      />
      <TenantsPager
        offset={offset}
        limit={LIMIT}
        total={data.total}
        onPrev={handlePrev}
        onNext={handleNext}
      />
    </div>
  );
}
