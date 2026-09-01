import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DOCUMENT_FILTER_OPTIONS, type DocumentFilter } from './model';

type DocumentRequestHintProps = {
  canRequestDocuments: boolean;
  eligibleOwnerCount: number;
  invitedOwnerCount: number;
  isArchived: boolean;
  linkedOwnerCount: number;
};

export function DocumentRequestHint({
  canRequestDocuments,
  eligibleOwnerCount,
  invitedOwnerCount,
  isArchived,
  linkedOwnerCount
}: DocumentRequestHintProps) {
  if (!canRequestDocuments) {
    return null;
  }

  if (isArchived) {
    return (
      <p className='rounded-xl border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground'>
        Restaurá la propiedad para solicitar documentación.
      </p>
    );
  }

  if (eligibleOwnerCount === 0) {
    return (
      <p className='rounded-xl border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground'>
        {linkedOwnerCount > 0
          ? 'Vinculá un propietario activo o invitado para solicitar documentación.'
          : 'Vinculá un propietario para solicitar documentación.'}
      </p>
    );
  }

  if (invitedOwnerCount > 0) {
    return (
      <p className='rounded-xl border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground'>
        Las solicitudes a propietarios invitados quedarán asociadas y podrán verlas cuando activen
        su acceso.
      </p>
    );
  }

  return null;
}

type DocumentRequestStatesProps = {
  isEmpty: boolean;
  isError: boolean;
  isLoading: boolean;
};

export function DocumentRequestStates({ isEmpty, isError, isLoading }: DocumentRequestStatesProps) {
  if (isLoading) {
    return <DocumentRequestsLoadingState />;
  }

  if (isError) {
    return <DocumentRequestsErrorState />;
  }

  return isEmpty ? <DocumentRequestsEmptyState /> : null;
}

function DocumentRequestsLoadingState() {
  return (
    <div className='space-y-3' aria-label='Cargando documentos'>
      {[0, 1, 2].map((item) => (
        <div key={item} className='space-y-2 rounded-xl border p-3'>
          <div className='h-4 w-40 animate-pulse rounded bg-muted' />
          <div className='h-3 w-full max-w-xl animate-pulse rounded bg-muted' />
          <div className='h-3 w-32 animate-pulse rounded bg-muted' />
        </div>
      ))}
    </div>
  );
}

export function DocumentRequestsErrorState() {
  return (
    <div className='rounded-xl border border-dashed p-4 text-sm text-muted-foreground'>
      No se pudieron cargar las solicitudes documentales.
    </div>
  );
}

export function DocumentRequestsEmptyState() {
  return (
    <div className='rounded-xl border border-dashed p-4 text-sm text-muted-foreground'>
      Todavía no hay solicitudes de documentos para esta propiedad.
    </div>
  );
}

type DocumentRequestFiltersProps = {
  activeFilter: DocumentFilter;
  counts: Record<DocumentFilter, number>;
  onFilterChange: (filter: DocumentFilter) => void;
};

export function DocumentRequestFilters({
  activeFilter,
  counts,
  onFilterChange
}: DocumentRequestFiltersProps) {
  return (
    <div
      role='tablist'
      className='flex flex-wrap gap-3 border-b border-border/40'
      aria-label='Filtros de solicitudes documentales'
    >
      {DOCUMENT_FILTER_OPTIONS.map((filter) => {
        const count = counts[filter.key];
        const isActive = activeFilter === filter.key;
        const isReviewWarning = filter.key === 'review' && isActive && count > 0;

        return (
          <Button
            key={filter.key}
            type='button'
            role='tab'
            tabIndex={0}
            variant='ghost'
            aria-label={`${filter.label} · ${count}`}
            aria-selected={isActive}
            className={cn(
              'min-h-11 rounded-none border-b-2 px-0 text-sm font-medium hover:bg-transparent',
              isActive
                ? 'border-foreground text-foreground'
                : 'border-transparent text-foreground/70 hover:border-border hover:text-foreground'
            )}
            onClick={() => onFilterChange(filter.key)}
          >
            <span>{filter.label}</span>
            <Badge
              variant='outline'
              className={cn(
                'ml-1 size-5 rounded-full p-0 text-[10px]',
                isReviewWarning
                  ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300'
                  : isActive
                    ? 'border-border bg-background text-foreground'
                    : 'border-border/70 bg-muted/40 text-foreground/70'
              )}
            >
              {count}
            </Badge>
          </Button>
        );
      })}
    </div>
  );
}
