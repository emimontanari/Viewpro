'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { canManagePropertyEngagements } from '@/lib/session';
import { useActiveTenant } from '@/lib/session-context';
import { cn } from '@/lib/utils';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import type { ProductListItem, PropertyArchiveFilter } from '../../api/types';
import { productsQueryOptions } from '../../api/queries';
import { archiveFilterOptions } from '../../constants/product-options';
import { QuickStatusSelect } from '../quick-status-select';
import {
  columns,
  formatPrice,
  getOperationTone,
  getOperationTypeLabel,
  getPropertyTypeLabel
} from './columns';
import { CellAction } from './cell-action';
import { OPERATION_TYPE_OPTIONS, PROPERTY_STATUS_OPTIONS } from './options';
import { PropertyTableToolbar } from './toolbar';
import { OwnerSummary, PropertyIdentity, PropertyMetric, SellerSummary } from './product-summary';

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
    return (
      <PropertyTableMessage
        tone='neutral'
        title='Seleccioná una inmobiliaria'
        description='Elegí un workspace para ver sus propiedades y gestiones activas.'
      />
    );
  }

  if (productsQuery.isLoading) {
    return <PropertyTableSkeleton />;
  }

  if (productsQuery.isError || !productsQuery.data) {
    return (
      <PropertyTableMessage
        tone='danger'
        title='No se pudieron cargar las propiedades'
        description='Reintentá en unos segundos. Si el problema sigue, revisá que el backend esté activo.'
        action={
          <Button variant='outline' size='sm' onClick={() => void productsQuery.refetch()}>
            Reintentar
          </Button>
        }
      />
    );
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
          <div className='hidden min-w-0 overflow-hidden rounded-2xl border bg-background shadow-xs md:block'>
            <Table className='table-fixed'>
              <TableHeader className='bg-muted/40'>
                <TableRow className='hover:bg-transparent'>
                  <TableHead className='w-[35%] px-3 py-3 text-xs uppercase tracking-wide text-muted-foreground'>
                    Propiedad
                  </TableHead>
                  <TableHead className='w-28 px-3 py-3 text-xs uppercase tracking-wide text-muted-foreground'>
                    Operación
                  </TableHead>
                  <TableHead className='w-36 px-3 py-3 text-xs uppercase tracking-wide text-muted-foreground'>
                    Estado
                  </TableHead>
                  <TableHead className='w-28 px-3 py-3 text-xs uppercase tracking-wide text-muted-foreground'>
                    Precio
                  </TableHead>
                  <TableHead className='w-36 px-3 py-3 text-xs uppercase tracking-wide text-muted-foreground'>
                    Propietario
                  </TableHead>
                  <TableHead className='hidden w-36 px-3 py-3 text-xs uppercase tracking-wide text-muted-foreground 2xl:table-cell'>
                    Vendedor
                  </TableHead>
                  <TableHead className='w-12 px-3 py-3' />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <PropertyTableRow
                    key={row.id}
                    canManageProperties={canManageProperties}
                    propertyEngagement={row.original}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          <div className='grid gap-3 md:hidden'>
            {rows.map((row) => (
              <PropertyMobileCard
                key={row.id}
                canManageProperties={canManageProperties}
                propertyEngagement={row.original}
              />
            ))}
          </div>
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

function PropertyTableRow({
  canManageProperties,
  propertyEngagement
}: {
  canManageProperties: boolean;
  propertyEngagement: ProductListItem;
}) {
  return (
    <TableRow className='group hover:bg-muted/30'>
      <TableCell className='whitespace-normal px-3 py-3'>
        <PropertyIdentity propertyEngagement={propertyEngagement} compact />
      </TableCell>
      <TableCell className='px-3 py-3'>
        <div className='flex flex-col gap-1.5'>
          <Badge
            variant='outline'
            className={cn('border', getOperationTone(propertyEngagement.operationType))}
          >
            {getOperationTypeLabel(propertyEngagement.operationType)}
          </Badge>
          <Badge
            variant='outline'
            className='hidden bg-background text-muted-foreground 2xl:inline-flex'
          >
            {getPropertyTypeLabel(propertyEngagement.property.propertyType)}
          </Badge>
        </div>
      </TableCell>
      <TableCell className='px-3 py-3'>
        <QuickStatusSelect
          canUpdateStatus={canManageProperties}
          propertyEngagement={propertyEngagement}
        />
      </TableCell>
      <TableCell className='whitespace-nowrap px-3 py-3 font-medium'>
        {formatPrice(propertyEngagement.publishedPriceCents, propertyEngagement.currency)}
      </TableCell>
      <TableCell className='whitespace-normal px-3 py-3'>
        <OwnerSummary propertyEngagement={propertyEngagement} />
      </TableCell>
      <TableCell className='hidden whitespace-normal px-3 py-3 2xl:table-cell'>
        <SellerSummary propertyEngagement={propertyEngagement} />
      </TableCell>
      <TableCell className='px-3 py-3 text-right'>
        <CellAction canManageProperties={canManageProperties} data={propertyEngagement} />
      </TableCell>
    </TableRow>
  );
}

function PropertyMobileCard({
  canManageProperties,
  propertyEngagement
}: {
  canManageProperties: boolean;
  propertyEngagement: ProductListItem;
}) {
  return (
    <article className='overflow-hidden rounded-2xl border bg-background shadow-xs'>
      <div className='p-4'>
        <div className='flex items-start justify-between gap-3'>
          <PropertyIdentity propertyEngagement={propertyEngagement} compact />
          <CellAction canManageProperties={canManageProperties} data={propertyEngagement} />
        </div>

        <div className='mt-4 flex flex-wrap gap-2'>
          <Badge
            variant='outline'
            className={cn('border', getOperationTone(propertyEngagement.operationType))}
          >
            {getOperationTypeLabel(propertyEngagement.operationType)}
          </Badge>
          <Badge variant='outline'>
            {getPropertyTypeLabel(propertyEngagement.property.propertyType)}
          </Badge>
          <QuickStatusSelect
            canUpdateStatus={canManageProperties}
            propertyEngagement={propertyEngagement}
            size='compact'
          />
        </div>

        <div className='mt-4 grid grid-cols-2 gap-3 text-sm'>
          <PropertyMetric
            label='Precio'
            value={formatPrice(propertyEngagement.publishedPriceCents, propertyEngagement.currency)}
          />
          <SellerSummary propertyEngagement={propertyEngagement} mobile />
          <OwnerSummary propertyEngagement={propertyEngagement} mobile />
          <PropertyMetric
            label='Imágenes'
            value={String(propertyEngagement.property.images.length)}
          />
        </div>
      </div>
    </article>
  );
}

function PropertyTablePagination({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);

  return (
    <div className='flex flex-col gap-3 rounded-2xl border bg-background p-3 text-sm text-muted-foreground shadow-xs sm:flex-row sm:items-center sm:justify-between'>
      <span>
        Mostrando {firstItem}-{lastItem} de {total}
      </span>
      <div className='flex items-center justify-between gap-2 sm:justify-end'>
        <Button
          variant='outline'
          size='sm'
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <Icons.chevronLeft className='size-4' /> Anterior
        </Button>
        <span className='min-w-20 text-center text-xs font-medium'>
          Página {page} de {pageCount}
        </span>
        <Button
          variant='outline'
          size='sm'
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Siguiente <Icons.chevronRight className='size-4' />
        </Button>
      </div>
    </div>
  );
}

function PropertyTableEmptyState({
  canManageProperties,
  hasFilters,
  onClearFilters
}: {
  canManageProperties: boolean;
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div className='rounded-2xl border border-dashed bg-muted/20 p-8 text-center'>
      <div className='mx-auto flex size-12 items-center justify-center rounded-full bg-background text-muted-foreground shadow-xs'>
        <Icons.workspace className='size-5' />
      </div>
      <h3 className='mt-4 text-base font-semibold'>No hay propiedades para mostrar</h3>
      <p className='mx-auto mt-2 max-w-md text-sm text-muted-foreground'>
        {hasFilters
          ? 'Los filtros actuales no tienen resultados. Probá limpiarlos para volver al inventario completo.'
          : canManageProperties
            ? 'Creá la primera propiedad para empezar a gestionar captación, publicación y seguimiento.'
            : 'Cuando tengas propiedades asignadas van a aparecer acá para seguimiento.'}
      </p>
      <div className='mt-5 flex flex-col justify-center gap-2 sm:flex-row'>
        {hasFilters ? (
          <Button variant='outline' onClick={onClearFilters}>
            Limpiar filtros
          </Button>
        ) : null}
        {canManageProperties ? (
          <Button asChild>
            <Link href='/dashboard/product/new'>
              <Icons.add className='size-4' /> Nueva propiedad
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function PropertyTableMessage({
  action,
  description,
  title,
  tone
}: {
  action?: React.ReactNode;
  description: string;
  title: string;
  tone: 'danger' | 'neutral';
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-dashed p-6 text-sm',
        tone === 'danger'
          ? 'border-destructive/30 bg-destructive/5 text-destructive'
          : 'bg-muted/20 text-muted-foreground'
      )}
    >
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h3 className='font-semibold text-foreground'>{title}</h3>
          <p className='mt-1'>{description}</p>
        </div>
        {action}
      </div>
    </div>
  );
}

export function PropertyTableSkeleton() {
  return (
    <div className='space-y-4'>
      <div className='rounded-2xl border bg-background p-4 shadow-xs'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div className='space-y-2'>
            <Skeleton className='h-5 w-56' />
            <Skeleton className='h-4 w-72' />
          </div>
          <div className='flex flex-wrap gap-2'>
            <Skeleton className='h-8 w-40' />
            <Skeleton className='h-8 w-40' />
            <Skeleton className='h-8 w-32' />
            <Skeleton className='h-8 w-24' />
          </div>
        </div>
      </div>
      <div className='hidden overflow-hidden rounded-2xl border bg-background md:block'>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className='flex items-center gap-4 border-b p-4 last:border-b-0'>
            <Skeleton className='h-16 w-24 rounded-xl' />
            <div className='flex-1 space-y-2'>
              <Skeleton className='h-4 w-64' />
              <Skeleton className='h-3 w-96' />
            </div>
            <Skeleton className='h-6 w-20' />
            <Skeleton className='h-6 w-28' />
            <Skeleton className='h-4 w-24' />
          </div>
        ))}
      </div>
      <div className='grid gap-3 md:hidden'>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className='rounded-2xl border bg-background p-4'>
            <div className='flex gap-3'>
              <Skeleton className='h-16 w-20 rounded-xl' />
              <div className='flex-1 space-y-2'>
                <Skeleton className='h-4 w-40' />
                <Skeleton className='h-3 w-full' />
              </div>
            </div>
            <div className='mt-4 grid grid-cols-2 gap-3'>
              <Skeleton className='h-16 rounded-xl' />
              <Skeleton className='h-16 rounded-xl' />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
