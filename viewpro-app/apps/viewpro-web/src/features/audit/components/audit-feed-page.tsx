'use client';

// Container: owns the list query + offset + filter state (read-only feed,
// no dialogs/mutations — mirrors tenants-management-page.tsx minus
// mutations). Filter state is nuqs-synced (design D9); rendering the actual
// controls is delegated to the presentational, controlled AuditFilterBar
// (design D10) — this component only owns state, not filter controls.
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { parseAsString, useQueryStates } from 'nuqs';
import { Skeleton } from '@/components/ui/skeleton';
import { auditFeedOptions } from '@/features/audit/api/queries';
import { getApiErrorMessage } from '@/lib/api-client';
import { AuditEmptyState } from './audit-empty-state';
import { AuditFilterBar } from './audit-filter-bar';
import {
  EMPTY_FILTER_VALUES,
  hasActiveAuditFilters,
  toAuditFilters,
  type AuditFilterValues
} from './audit-filters';
import { AuditPager } from './audit-pager';
import { AuditTable } from './audit-table';

const LIMIT = 50;

// nuqs (design D9) — filter state is URL-synced/shareable investigation
// state, mirrors adminActivityOptions/adminKeys.activity's filter-in-key
// pattern. `replace` (not `push`) so each keystroke/selection doesn't spam
// browser history; `clearOnDefault` drops a param from the URL entirely
// once it's back to '' instead of leaving a stray `?action=`.
const FILTER_PARSERS = {
  action: parseAsString.withDefault(EMPTY_FILTER_VALUES.action),
  source: parseAsString.withDefault(EMPTY_FILTER_VALUES.source),
  tenantId: parseAsString.withDefault(EMPTY_FILTER_VALUES.tenantId),
  actorId: parseAsString.withDefault(EMPTY_FILTER_VALUES.actorId),
  dateFrom: parseAsString.withDefault(EMPTY_FILTER_VALUES.dateFrom),
  dateTo: parseAsString.withDefault(EMPTY_FILTER_VALUES.dateTo)
};

const FILTER_QUERY_OPTIONS = { history: 'replace', clearOnDefault: true } as const;

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
  const [filterValues, setFilterValues] = useQueryStates(FILTER_PARSERS, FILTER_QUERY_OPTIONS);

  const filters = React.useMemo(() => toAuditFilters(filterValues), [filterValues]);
  const filtersActive = hasActiveAuditFilters(filterValues);

  const { data, isLoading, isError, error } = useQuery({
    ...auditFeedOptions(offset, LIMIT, filters),
    retry: false
  });

  const handleFilterChange = React.useCallback(
    (patch: Partial<AuditFilterValues>) => {
      // Req: Server-driven filter bar — any filter change re-queries from
      // the top of the result set. An operator narrowing an investigation
      // should never land on a stale/out-of-range offset from before the
      // filter changed.
      setOffset(0);
      void setFilterValues(patch);
    },
    [setFilterValues]
  );

  const handleClearFilters = React.useCallback(() => {
    setOffset(0);
    void setFilterValues(EMPTY_FILTER_VALUES);
  }, [setFilterValues]);

  const handlePrev = React.useCallback(() => {
    setOffset((current) => Math.max(0, current - LIMIT));
  }, []);

  const handleNext = React.useCallback(() => {
    setOffset((current) => (data && current + LIMIT < data.total ? current + LIMIT : current));
  }, [data]);

  const filterBar = (
    <AuditFilterBar
      values={filterValues}
      onChange={handleFilterChange}
      onClear={handleClearFilters}
      hasActiveFilters={filtersActive}
    />
  );

  if (isLoading) {
    return (
      <div className='flex flex-col gap-4'>
        {filterBar}
        <AuditLoadingSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className='flex flex-col gap-4'>
        {filterBar}
        <div
          data-testid='audit-error'
          className='border-destructive/30 bg-destructive/5 rounded-xl border p-6'
        >
          <p className='text-destructive font-semibold'>No se pudo cargar la auditoría</p>
          <p className='text-muted-foreground mt-1 text-sm'>{getApiErrorMessage(error)}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  if (data.total === 0) {
    return (
      <div className='flex flex-col gap-4'>
        {filterBar}
        <AuditEmptyState filtered={filtersActive} />
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-4'>
      {filterBar}
      <AuditTable items={data.items} />
      <AuditPager offset={offset} limit={LIMIT} total={data.total} onPrev={handlePrev} onNext={handleNext} />
    </div>
  );
}
