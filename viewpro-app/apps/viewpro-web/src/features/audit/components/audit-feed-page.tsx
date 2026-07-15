'use client';

// Container: owns the list query + offset state only (read-only feed, no
// dialogs/mutations — mirrors tenants-management-page.tsx minus mutations).
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { auditFeedOptions } from '@/features/audit/api/queries';
import { getApiErrorMessage } from '@/lib/api-client';
import { AuditEmptyState } from './audit-empty-state';
import { AuditPager } from './audit-pager';
import { AuditTable } from './audit-table';

const LIMIT = 50;

function AuditLoadingSkeleton() {
  return (
    <div data-testid='audit-loading' className='flex flex-col gap-3'>
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className='h-12 w-full rounded-xl' />
      ))}
    </div>
  );
}

export function AuditFeedPage() {
  const [offset, setOffset] = React.useState(0);

  const { data, isLoading, isError, error } = useQuery({
    ...auditFeedOptions(offset, LIMIT),
    retry: false
  });

  const handlePrev = React.useCallback(() => {
    setOffset((current) => Math.max(0, current - LIMIT));
  }, []);

  const handleNext = React.useCallback(() => {
    setOffset((current) => (data && current + LIMIT < data.total ? current + LIMIT : current));
  }, [data]);

  if (isLoading) {
    return <AuditLoadingSkeleton />;
  }

  if (isError) {
    return (
      <div
        data-testid='audit-error'
        className='border-destructive/30 bg-destructive/5 rounded-xl border p-6'
      >
        <p className='text-destructive font-semibold'>No se pudo cargar la auditoría</p>
        <p className='text-muted-foreground mt-1 text-sm'>{getApiErrorMessage(error)}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  if (data.total === 0) {
    return <AuditEmptyState />;
  }

  return (
    <div className='flex flex-col gap-4'>
      <AuditTable items={data.items} />
      <AuditPager offset={offset} limit={LIMIT} total={data.total} onPrev={handlePrev} onNext={handleNext} />
    </div>
  );
}
