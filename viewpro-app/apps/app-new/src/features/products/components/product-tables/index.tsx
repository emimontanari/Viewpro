'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { useActiveTenant } from '@/lib/session-context';
import { cn } from '@/lib/utils';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import type { Product, PropertyArchiveFilter } from '../../api/types';
import { productsQueryOptions } from '../../api/queries';
import { archiveFilterOptions } from '../../constants/product-options';
import { QuickStatusSelect } from '../quick-status-select';
import {
  columns,
  formatPrice,
  getAddress,
  getAgentSummary,
  getArchivedTone,
  getOperationTone,
  getOperationTypeLabel,
  getPropertyFacts,
  getPropertyTypeLabel,
  isArchivedProduct
} from './columns';
import { OPERATION_TYPE_OPTIONS, PROPERTY_STATUS_OPTIONS } from './options';
import { CellAction } from './cell-action';

const ALL_FILTERS_VALUE = 'all';
const DEFAULT_ARCHIVE_FILTER: PropertyArchiveFilter = 'active';
const PAGE_SIZE_OPTIONS = [10, 20, 50];

export function ProductTable() {
  const { activeTenantId, isTenantLoading } = useActiveTenant();
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
        archivedFilter={archivedFilter}
        hasFilters={hasFilters}
        operationType={params.operationType}
        pageSize={params.perPage}
        status={params.status}
        total={total}
        visibleCount={products.length}
        isFetching={productsQuery.isFetching}
        onArchiveFilterChange={setArchiveFilter}
        onClearFilters={clearFilters}
        onFilterChange={setFilter}
        onPageSizeChange={setPageSize}
      />

      {rows.length === 0 ? (
        <PropertyTableEmptyState hasFilters={hasFilters} onClearFilters={clearFilters} />
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
                    Agente
                  </TableHead>
                  <TableHead className='w-12 px-3 py-3' />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <PropertyTableRow key={row.id} propertyEngagement={row.original} />
                ))}
              </TableBody>
            </Table>
          </div>

          <div className='grid gap-3 md:hidden'>
            {rows.map((row) => (
              <PropertyMobileCard key={row.id} propertyEngagement={row.original} />
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

function PropertyTableToolbar({
  activeFilterCount,
  archivedFilter,
  hasFilters,
  isFetching,
  operationType,
  pageSize,
  status,
  total,
  visibleCount,
  onArchiveFilterChange,
  onClearFilters,
  onFilterChange,
  onPageSizeChange
}: {
  activeFilterCount: number;
  archivedFilter: PropertyArchiveFilter;
  hasFilters: boolean;
  isFetching: boolean;
  operationType: string | null;
  pageSize: number;
  status: string | null;
  total: number;
  visibleCount: number;
  onArchiveFilterChange: (value: string) => void;
  onClearFilters: () => void;
  onFilterChange: (key: 'operationType' | 'status', value: string) => void;
  onPageSizeChange: (pageSize: string) => void;
}) {
  const operationLabel = getOptionLabel(OPERATION_TYPE_OPTIONS, operationType);
  const statusLabel = getOptionLabel(PROPERTY_STATUS_OPTIONS, status);
  const archiveLabel =
    archivedFilter === DEFAULT_ARCHIVE_FILTER
      ? undefined
      : getOptionLabel(archiveFilterOptions, archivedFilter);

  return (
    <div className='overflow-hidden rounded-2xl border bg-background shadow-xs'>
      <div className='space-y-4 border-b bg-muted/20 p-4'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div className='space-y-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <h2 className='text-base font-semibold tracking-tight'>Inventario de propiedades</h2>
              {hasFilters ? (
                <Badge variant='outline' className='bg-background text-muted-foreground'>
                  {activeFilterCount}{' '}
                  {activeFilterCount === 1 ? 'filtro activo' : 'filtros activos'}
                </Badge>
              ) : null}
              {isFetching ? (
                <Badge variant='outline' className='text-muted-foreground'>
                  Actualizando
                </Badge>
              ) : null}
            </div>
            <p className='text-sm text-muted-foreground'>
              {getPropertyTableSummary({ hasFilters, total, visibleCount })}
            </p>
          </div>

          <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
            <Button asChild size='sm' className='sm:hidden'>
              <Link href='/dashboard/product/new'>
                <Icons.add className='size-4' /> Nueva propiedad
              </Link>
            </Button>
            <FilterSelect
              allLabel='Todas las operaciones'
              label='Operación'
              value={operationType}
              options={OPERATION_TYPE_OPTIONS}
              onValueChange={(value) => onFilterChange('operationType', value)}
            />
            <FilterSelect
              allLabel='Todos los estados'
              label='Estado comercial'
              value={status}
              options={PROPERTY_STATUS_OPTIONS}
              onValueChange={(value) => onFilterChange('status', value)}
            />
            <ArchiveFilterSelect value={archivedFilter} onValueChange={onArchiveFilterChange} />
            <Select value={String(pageSize)} onValueChange={onPageSizeChange}>
              <SelectTrigger size='sm' className='w-full sm:w-[112px]'>
                <SelectValue aria-label={`${pageSize} por página`} />
              </SelectTrigger>
              <SelectContent align='end'>
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option} / pág.
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters ? (
              <Button variant='outline' size='sm' onClick={onClearFilters}>
                <Icons.close className='size-4' /> Limpiar filtros
              </Button>
            ) : null}
          </div>
        </div>

        {hasFilters ? (
          <ActiveFilterSummary
            archiveLabel={archiveLabel}
            operationLabel={operationLabel}
            statusLabel={statusLabel}
            onClearFilters={onClearFilters}
          />
        ) : null}
      </div>
    </div>
  );
}

function getPropertyTableSummary({
  hasFilters,
  total,
  visibleCount
}: {
  hasFilters: boolean;
  total: number;
  visibleCount: number;
}) {
  if (total === 0) {
    return hasFilters
      ? 'No encontramos propiedades con esos filtros.'
      : 'Todavía no hay propiedades cargadas.';
  }

  const resultLabel = total === 1 ? 'gestión inmobiliaria' : 'gestiones inmobiliarias';
  const filterContext = hasFilters ? 'con filtros' : 'en total';
  return `${total} ${resultLabel} ${filterContext} · ${visibleCount} en esta vista`;
}

function ActiveFilterSummary({
  archiveLabel,
  operationLabel,
  statusLabel,
  onClearFilters
}: {
  archiveLabel?: string;
  operationLabel?: string;
  statusLabel?: string;
  onClearFilters: () => void;
}) {
  return (
    <div className='flex flex-col gap-2 rounded-xl border bg-background/70 p-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between'>
      <div className='flex flex-wrap items-center gap-2'>
        <span className='font-medium text-foreground'>Vista filtrada</span>
        {operationLabel ? <FilterBadge label='Operación' value={operationLabel} /> : null}
        {statusLabel ? <FilterBadge label='Estado' value={statusLabel} /> : null}
        {archiveLabel ? <FilterBadge label='Archivo' value={archiveLabel} /> : null}
      </div>
      <Button variant='ghost' size='sm' onClick={onClearFilters} className='h-7 w-fit px-2 text-xs'>
        Ver todo el inventario
      </Button>
    </div>
  );
}

function FilterBadge({ label, value }: { label: string; value: string }) {
  return (
    <Badge variant='outline' className='rounded-full bg-background text-foreground'>
      {label}: {value}
    </Badge>
  );
}

function FilterSelect({
  allLabel,
  label,
  value,
  options,
  onValueChange
}: {
  allLabel: string;
  label: string;
  value: string | null;
  options: Array<{ value: string; label: string }>;
  onValueChange: (value: string) => void;
}) {
  return (
    <Select value={value ?? ALL_FILTERS_VALUE} onValueChange={onValueChange}>
      <SelectTrigger size='sm' aria-label={label} className='w-full sm:w-[176px]'>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent align='end'>
        <SelectItem value={ALL_FILTERS_VALUE}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ArchiveFilterSelect({
  value,
  onValueChange
}: {
  value: PropertyArchiveFilter;
  onValueChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger size='sm' aria-label='Archivo' className='w-full sm:w-[150px]'>
        <SelectValue placeholder='Archivo' />
      </SelectTrigger>
      <SelectContent align='end'>
        {archiveFilterOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function getOptionLabel(options: Array<{ value: string; label: string }>, value: string | null) {
  return value ? options.find((option) => option.value === value)?.label : undefined;
}

function PropertyTableRow({ propertyEngagement }: { propertyEngagement: Product }) {
  const agent = getAgentSummary(propertyEngagement);

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
        <QuickStatusSelect propertyEngagement={propertyEngagement} />
      </TableCell>
      <TableCell className='whitespace-nowrap px-3 py-3 font-medium'>
        {formatPrice(propertyEngagement.publishedPriceCents, propertyEngagement.currency)}
      </TableCell>
      <TableCell className='whitespace-normal px-3 py-3'>
        <OwnerSummary propertyEngagement={propertyEngagement} />
      </TableCell>
      <TableCell className='hidden whitespace-normal px-3 py-3 2xl:table-cell'>
        <div className='max-w-36'>
          <p className='truncate text-sm font-medium'>{agent.label}</p>
          <p className='truncate text-xs text-muted-foreground'>{agent.detail}</p>
        </div>
      </TableCell>
      <TableCell className='px-3 py-3 text-right'>
        <CellAction data={propertyEngagement} />
      </TableCell>
    </TableRow>
  );
}

function PropertyMobileCard({ propertyEngagement }: { propertyEngagement: Product }) {
  const agent = getAgentSummary(propertyEngagement);

  return (
    <article className='overflow-hidden rounded-2xl border bg-background shadow-xs'>
      <div className='p-4'>
        <div className='flex items-start justify-between gap-3'>
          <PropertyIdentity propertyEngagement={propertyEngagement} compact />
          <CellAction data={propertyEngagement} />
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
          <QuickStatusSelect propertyEngagement={propertyEngagement} size='compact' />
        </div>

        <div className='mt-4 grid grid-cols-2 gap-3 text-sm'>
          <PropertyMetric
            label='Precio'
            value={formatPrice(propertyEngagement.publishedPriceCents, propertyEngagement.currency)}
          />
          <PropertyMetric label='Agente' value={agent.label} mutedValue={agent.detail} />
          <PropertyMetric
            label='Propietario'
            value={propertyEngagement.property.ownerName ?? 'Sin nombre'}
            mutedValue={propertyEngagement.property.ownerEmail ?? undefined}
          />
          <PropertyMetric
            label='Imágenes'
            value={String(propertyEngagement.property.images.length)}
          />
        </div>
      </div>
    </article>
  );
}

function PropertyIdentity({
  compact = false,
  propertyEngagement
}: {
  compact?: boolean;
  propertyEngagement: Product;
}) {
  const propertyFacts = getPropertyFacts(propertyEngagement);

  return (
    <div className='flex min-w-0 items-center gap-3'>
      <PropertyThumbnail propertyEngagement={propertyEngagement} compact={compact} />
      <div className='min-w-0'>
        <div className='flex min-w-0 items-center gap-2'>
          <p className='min-w-0 truncate font-medium'>{propertyEngagement.property.title}</p>
          {isArchivedProduct(propertyEngagement) ? <ArchivedBadge /> : null}
        </div>
        <p className='mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground'>
          {getAddress(propertyEngagement)}
        </p>
        {propertyFacts ? (
          <p className='mt-1 truncate text-xs font-medium text-muted-foreground'>{propertyFacts}</p>
        ) : null}
      </div>
    </div>
  );
}

function ArchivedBadge() {
  return (
    <Badge variant='outline' className={cn('shrink-0 border text-[11px]', getArchivedTone())}>
      Archivada
    </Badge>
  );
}

function PropertyThumbnail({
  compact = false,
  propertyEngagement
}: {
  compact?: boolean;
  propertyEngagement: Product;
}) {
  const imageUrl = propertyEngagement.property.primaryImage?.url;
  const sizeClass = compact ? 'h-16 w-20' : 'h-16 w-24';

  if (imageUrl) {
    return (
      <div
        role='img'
        aria-label={`Imagen de ${propertyEngagement.property.title}`}
        className={cn('shrink-0 rounded-xl border bg-cover bg-center shadow-xs', sizeClass)}
        style={{ backgroundImage: `url(${imageUrl})` }}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl border border-dashed bg-muted/50 text-muted-foreground',
        sizeClass
      )}
    >
      <Icons.media className='size-5' />
    </div>
  );
}

function OwnerSummary({ propertyEngagement }: { propertyEngagement: Product }) {
  return (
    <div className='max-w-48'>
      <p className='truncate text-sm font-medium'>
        {propertyEngagement.property.ownerName ?? 'Sin nombre'}
      </p>
      <p className='truncate text-xs text-muted-foreground'>
        {propertyEngagement.property.ownerEmail ?? 'Sin email'}
      </p>
    </div>
  );
}

function PropertyMetric({
  label,
  mutedValue,
  value
}: {
  label: string;
  mutedValue?: string;
  value: string;
}) {
  return (
    <div className='rounded-xl border bg-muted/20 p-3'>
      <p className='text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>
        {label}
      </p>
      <p className='mt-1 truncate font-medium'>{value}</p>
      {mutedValue ? <p className='truncate text-xs text-muted-foreground'>{mutedValue}</p> : null}
    </div>
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
  hasFilters,
  onClearFilters
}: {
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
          : 'Creá la primera propiedad para empezar a gestionar captación, publicación y seguimiento.'}
      </p>
      <div className='mt-5 flex flex-col justify-center gap-2 sm:flex-row'>
        {hasFilters ? (
          <Button variant='outline' onClick={onClearFilters}>
            Limpiar filtros
          </Button>
        ) : null}
        <Button asChild>
          <Link href='/dashboard/product/new'>
            <Icons.add className='size-4' /> Nueva propiedad
          </Link>
        </Button>
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
