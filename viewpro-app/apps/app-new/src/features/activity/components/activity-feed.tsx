'use client';

import { useState, type ReactNode } from 'react';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ActivityFeedItem as ActivityFeedItemType } from '../api/types';
import { ActivityFeedItem } from './activity-feed-item';
import { ActivityMovementDetailDialog } from './activity-movement-detail-dialog';

export function ActivityFeed({
  isError,
  isFetching,
  isLoading,
  items,
  page,
  pageCount,
  total,
  onPageChange,
  onRetry
}: {
  isError: boolean;
  isFetching: boolean;
  isLoading: boolean;
  items: ActivityFeedItemType[];
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
  onRetry: () => void;
}) {
  const [selectedItem, setSelectedItem] = useState<ActivityFeedItemType | null>(null);

  if (isLoading) {
    return <ActivityFeedSkeleton />;
  }

  if (isError) {
    return (
      <ActivityFeedMessage
        tone='danger'
        title='No se pudo cargar el seguimiento'
        description='Reintentá en unos segundos. Si el problema sigue, revisá que la sesión siga activa.'
        action={
          <Button type='button' variant='outline' size='sm' onClick={onRetry}>
            Reintentar
          </Button>
        }
      />
    );
  }

  if (items.length === 0) {
    return (
      <ActivityFeedMessage
        title='Sin movimientos para mostrar'
        description='Cuando haya actualizaciones en las propiedades, van a aparecer en este seguimiento.'
      />
    );
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h2 className='text-base font-semibold'>Últimas actualizaciones</h2>
          <p className='text-sm text-muted-foreground'>
            {total} {total === 1 ? 'movimiento encontrado' : 'movimientos encontrados'}
            {isFetching ? ' · actualizando…' : ''}
          </p>
        </div>
      </div>

      <ol className='space-y-3'>
        {items.map((item) => (
          <li key={item.id}>
            <ActivityFeedItem item={item} onViewDetails={setSelectedItem} />
          </li>
        ))}
      </ol>

      <ActivityMovementDetailDialog
        item={selectedItem}
        open={Boolean(selectedItem)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedItem(null);
          }
        }}
      />

      {pageCount > 1 ? (
        <div className='flex flex-col gap-2 rounded-2xl border bg-card p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between'>
          <p className='text-sm text-muted-foreground'>
            Página {page} de {pageCount}
          </p>
          <div className='flex gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Anterior
            </Button>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={page >= pageCount}
              onClick={() => onPageChange(page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ActivityFeedSkeleton() {
  return (
    <section className='space-y-3' aria-label='Cargando seguimiento'>
      {[0, 1, 2, 3].map((item) => (
        <Card key={item} className='py-0'>
          <CardContent className='space-y-4 p-4'>
            <div className='flex items-center gap-2'>
              <div className='h-5 w-28 animate-pulse rounded-full bg-muted' />
              <div className='h-5 w-20 animate-pulse rounded-full bg-muted' />
            </div>
            <div className='space-y-2'>
              <div className='h-5 w-56 animate-pulse rounded bg-muted' />
              <div className='h-4 w-full max-w-xl animate-pulse rounded bg-muted' />
            </div>
            <div className='h-4 w-full animate-pulse rounded bg-muted' />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function ActivityFeedMessage({
  action,
  description,
  title,
  tone = 'neutral'
}: {
  action?: ReactNode;
  description: string;
  title: string;
  tone?: 'danger' | 'neutral';
}) {
  return (
    <div className='rounded-2xl border bg-card p-6 text-center shadow-xs'>
      <div className='mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground'>
        {tone === 'danger' ? (
          <Icons.warning className='size-5' />
        ) : (
          <Icons.clock className='size-5' />
        )}
      </div>
      <h2 className='text-base font-semibold'>{title}</h2>
      <p className='mx-auto mt-2 max-w-xl text-sm text-muted-foreground'>{description}</p>
      {action ? <div className='mt-4 flex justify-center'>{action}</div> : null}
    </div>
  );
}
