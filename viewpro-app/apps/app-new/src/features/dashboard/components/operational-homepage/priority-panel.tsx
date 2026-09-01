'use client';

/**
 * The priority panel and the rows inside it.
 */

import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Card, CardContent } from '@/components/ui/card';

export function PriorityCard({
  attentionCount,
  documentRequestCount,
  hasDataError,
  isLoading,
  rangeDays,
  staleCount
}: {
  attentionCount: number;
  documentRequestCount: number;
  hasDataError: boolean;
  isLoading: boolean;
  rangeDays: number;
  staleCount: number;
}) {
  return (
    <Card className='border-dashed bg-muted/20 py-0'>
      <CardContent className='space-y-4 p-5'>
        <div className='flex items-center gap-3'>
          <div className='flex size-10 items-center justify-center rounded-full bg-background text-muted-foreground'>
            <Icons.clock className='size-5' />
          </div>
          <div>
            <p className='text-sm text-muted-foreground'>Prioridad del día</p>
            <p className='font-semibold'>Atender antes de que pregunten</p>
          </div>
        </div>
        <p className='text-sm text-muted-foreground'>
          Usá este paneo para mantener las gestiones visibles, ordenar documentos y reducir
          consultas repetitivas.
        </p>
        <div className='rounded-2xl border bg-background/70 p-3 text-sm'>
          {hasDataError
            ? 'No se pudo cargar el resumen. Reintentá en unos segundos.'
            : isLoading
              ? 'Preparando el resumen operativo…'
              : `${staleCount} gestiones no tuvieron novedades en ${rangeDays} días.`}
        </div>
        <div className='grid gap-2'>
          <PriorityLink
            action='Actualizar'
            ariaLabel={`Ver ${staleCount} gestiones sin novedades en ${rangeDays} días en seguimiento`}
            count={staleCount}
            href='/dashboard/seguimiento'
            label={`Sin novedades en ${rangeDays} días`}
          />
          <PriorityLink
            action='Resolver'
            ariaLabel={`Ver ${attentionCount} próximos pasos pendientes en seguimiento`}
            count={attentionCount}
            href='/dashboard/seguimiento'
            label='Próximos pasos pendientes'
          />
          <PriorityLink
            action='Revisar'
            ariaLabel={`Ver ${documentRequestCount} documentos recientes en seguimiento`}
            count={documentRequestCount}
            href='/dashboard/seguimiento?kind=document_request'
            label='Documentos recientes'
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function PriorityLink({
  action,
  ariaLabel,
  count,
  href,
  label
}: {
  action: string;
  ariaLabel: string;
  count: number;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className='flex min-h-11 items-center justify-between gap-3 rounded-2xl border bg-background/80 px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground'
    >
      <span className='min-w-0'>
        <span className='block font-medium'>{action}</span>
        <span className='block truncate text-muted-foreground'>{label}</span>
      </span>
      <span className='shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'>
        {count}
      </span>
    </Link>
  );
}
