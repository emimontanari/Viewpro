import { Icons } from '@/components/icons';
import type { Product } from '../api/types';
import { formatDateTime } from '../utils/format-date-time';
import { QuickStatusSelect } from './quick-status-select';

type PropertyStatusSummaryProps = {
  isArchived: boolean;
  propertyEngagement: Product;
};

export function PropertyStatusSummary({
  isArchived,
  propertyEngagement
}: PropertyStatusSummaryProps) {
  return (
    <>
      <div className='rounded-xl border bg-muted/20 p-5'>
        <div className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
          Precio publicado
        </div>
        <div className='mt-3 text-4xl font-bold tracking-tight'>
          {formatPrice(propertyEngagement.publishedPriceCents, propertyEngagement.currency)}
        </div>
        <p className='mt-2 text-xs text-muted-foreground'>
          Moneda: {propertyEngagement.currency ?? 'ARS'}
        </p>
      </div>

      <ReadOnlyStatusField propertyEngagement={propertyEngagement} />

      {isArchived ? (
        <ArchivedStatePanel
          archivedAt={propertyEngagement.archivedAt}
          archiveReason={propertyEngagement.archiveReason}
        />
      ) : null}
    </>
  );
}

function ArchivedStatePanel({
  archivedAt,
  archiveReason
}: {
  archivedAt: string | null;
  archiveReason: string | null;
}) {
  return (
    <div className='space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200'>
      <div className='flex items-center gap-2'>
        <Icons.eyeOff className='size-4' />
        <div className='text-xs font-medium uppercase tracking-wide'>Archivada</div>
      </div>
      <div className='space-y-2 text-sm'>
        <div>
          <span className='font-medium'>Fecha: </span>
          {formatDateTime(archivedAt)}
        </div>
        {archiveReason ? (
          <div>
            <span className='font-medium'>Motivo: </span>
            <span className='break-words'>{archiveReason}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ReadOnlyStatusField({ propertyEngagement }: { propertyEngagement: Product }) {
  return (
    <div className='space-y-3 rounded-xl border bg-muted/20 p-4'>
      <div>
        <div className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
          Estado comercial
        </div>
        <p className='mt-1 text-xs text-muted-foreground'>
          Actualizá el avance sin entrar a edición completa.
        </p>
      </div>
      <QuickStatusSelect
        propertyEngagement={propertyEngagement}
        className='h-10 max-w-none rounded-lg px-3 text-sm'
      />
    </div>
  );
}

function formatPrice(value: number | null, currency: string | null) {
  if (value === null) {
    return 'Sin precio';
  }

  return new Intl.NumberFormat('es-AR', {
    currency: currency ?? 'ARS',
    maximumFractionDigits: 0,
    style: 'currency'
  }).format(value / 100);
}
