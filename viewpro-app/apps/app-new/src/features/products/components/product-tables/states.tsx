import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { ReactNode } from 'react';

export function PropertyTableMissingTenantState() {
  return (
    <PropertyTableMessage
      tone='neutral'
      title='Seleccioná una inmobiliaria'
      description='Elegí un workspace para ver sus propiedades y gestiones activas.'
    />
  );
}

export function PropertyTableErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <PropertyTableMessage
      tone='danger'
      title='No se pudieron cargar las propiedades'
      description='Reintentá en unos segundos. Si el problema sigue, revisá que el backend esté activo.'
      action={
        <Button variant='outline' size='sm' onClick={onRetry}>
          Reintentar
        </Button>
      }
    />
  );
}

export function PropertyTableEmptyState({
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
  action?: ReactNode;
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
