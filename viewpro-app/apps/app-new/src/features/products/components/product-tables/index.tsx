'use client';

import { canManagePropertyEngagements } from '@/lib/session';
import { useActiveTenant } from '@/lib/session-context';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import type { PropertyArchiveFilter } from '../../api/types';
import { productsQueryOptions } from '../../api/queries';
import { archiveFilterOptions } from '../../constants/product-options';
import { columns } from './columns';
import { PropertyDesktopTable } from './desktop-table';
import { PropertyMobileCards } from './mobile-cards';
import { OPERATION_TYPE_OPTIONS, PROPERTY_STATUS_OPTIONS } from './options';
import { PropertyTablePagination } from './pagination';
import { PropertyTableToolbar } from './toolbar';
import {
  PropertyTableEmptyState,
  PropertyTableErrorState,
  PropertyTableMissingTenantState,
  PropertyTableSkeleton
} from './states';

const ALL_FILTERS_VALUE = 'all';
const DEFAULT_ARCHIVE_FILTER: PropertyArchiveFilter = 'active';
const PAGE_SIZE_OPTIONS = [10, 20, 50];

export function ProductTable() {
  const { activeMembership, activeTenantId, isTenantLoading } = useActiveTenant();
  const [params, setParams] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(10),
    operationType: parseAsString,
    status: parseAsString,
    archived: parseAsString.withDefault(DEFAULT_ARCHIVE_FILTER)
  });
  const archivedFilter = params.archived as PropertyArchiveFilter;

  const filters = {
    page: params.page,
    limit: params.perPage,
    tenantId: activeTenantId,
    archived: archivedFilter,
    ...(params.operationType && { operationType: params.operationType }),
    ...(params.status && { status: params.status })
  };

  const productsQuery = useQuery({
    ...productsQueryOptions(filters),
    enabled: Boolean(activeTenantId) && !isTenantLoading
  });

  const products = productsQuery.data?.items ?? [];
  const total = productsQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / params.perPage));
  const table = useReactTable({
    columns,
    data: products,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
    state: {
      pagination: {
        pageIndex: params.page - 1,
        pageSize: params.perPage
      }
    }
  });

  const rows = table.getRowModel().rows;
  const hasArchiveFilter = archivedFilter !== DEFAULT_ARCHIVE_FILTER;
  const hasFilters = Boolean(params.status || params.operationType || hasArchiveFilter);
  const activeFilterCount =
    Number(Boolean(params.status)) +
    Number(Boolean(params.operationType)) +
    Number(hasArchiveFilter);
  const canManageProperties = canManagePropertyEngagements(activeMembership);
  const operationLabel = getOptionLabel(OPERATION_TYPE_OPTIONS, params.operationType);
  const statusLabel = getOptionLabel(PROPERTY_STATUS_OPTIONS, params.status);
  const archiveLabel =
    archivedFilter === DEFAULT_ARCHIVE_FILTER
      ? undefined
      : getOptionLabel(archiveFilterOptions, archivedFilter);

  const setFilter = (key: 'operationType' | 'status', value: string) => {
    void setParams({
      [key]: value === ALL_FILTERS_VALUE ? null : value,
      page: 1
    });
  };

  const setArchiveFilter = (value: string) => {
    void setParams({
      archived: value === DEFAULT_ARCHIVE_FILTER ? null : value,
      page: 1
    });
  };

  const setOperationType = (value: string) => setFilter('operationType', value);
  const setStatus = (value: string) => setFilter('status', value);

  const clearFilters = () => {
    void setParams({ archived: null, operationType: null, page: 1, status: null });
  };

  const setPage = (page: number) => {
    void setParams({ page: Math.min(Math.max(page, 1), pageCount) });
  };

  const setPageSize = (pageSize: string) => {
    void setParams({ page: 1, perPage: Number(pageSize) });
  };

  if (isTenantLoading) {
    return <PropertyTableSkeleton />;
  }

  if (!activeTenantId) {
    return <PropertyTableMissingTenantState />;
  }

  if (productsQuery.isLoading) {
    return <PropertyTableSkeleton />;
  }

  if (productsQuery.isError || !productsQuery.data) {
    return <PropertyTableErrorState onRetry={() => void productsQuery.refetch()} />;
  }

  return (
    <section className='min-w-0 space-y-4'>
      <PropertyTableToolbar
        activeFilterCount={activeFilterCount}
        archiveLabel={archiveLabel}
        archiveOptions={archiveFilterOptions}
        archivedFilter={archivedFilter}
        allValue={ALL_FILTERS_VALUE}
        canManageProperties={canManageProperties}
        hasFilters={hasFilters}
        isFetching={productsQuery.isFetching}
        operationLabel={operationLabel}
        operationOptions={OPERATION_TYPE_OPTIONS}
        operationType={params.operationType ?? ALL_FILTERS_VALUE}
        pageSize={params.perPage}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
        status={params.status ?? ALL_FILTERS_VALUE}
        statusLabel={statusLabel}
        statusOptions={PROPERTY_STATUS_OPTIONS}
        total={total}
        visibleCount={products.length}
        onArchiveFilterChange={setArchiveFilter}
        onClearFilters={clearFilters}
        onOperationTypeChange={setOperationType}
        onPageSizeChange={setPageSize}
        onStatusChange={setStatus}
      />

      {rows.length === 0 ? (
        <PropertyTableEmptyState
          canManageProperties={canManageProperties}
          hasFilters={hasFilters}
          onClearFilters={clearFilters}
        />
      ) : (
        <>
          <PropertyDesktopTable rows={rows} canManageProperties={canManageProperties} />

          <PropertyMobileCards products={products} canManageProperties={canManageProperties} />
        </>
      )}

      {total > 0 ? (
        <PropertyTablePagination
          page={params.page}
          pageCount={pageCount}
          pageSize={params.perPage}
          total={total}
          onPageChange={setPage}
        />
      ) : null}
    </section>
  );
}

function getOptionLabel(options: Array<{ value: string; label: string }>, value: string | null) {
  return value ? options.find((option) => option.value === value)?.label : undefined;
}

export { PropertyTableSkeleton };
