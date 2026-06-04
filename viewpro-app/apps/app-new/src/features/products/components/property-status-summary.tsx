import { Icons } from '@/components/icons';
import type { Product } from '../api/types';
import { formatDateTime } from '../utils/format-date-time';
import { SectionHeader } from './section-header';
import { getProductStatusPanelTone } from './status-tones';
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
        <SectionHeader icon={Icons.creditCard} label='Precio publicado' />
        <div className='mt-3 text-4xl font-bold tracking-tight'>
          {formatPrice(propertyEngagement.publishedPriceCents, propertyEngagement.currency)}
        </div>
        <p className='mt-2 text-xs text-foreground/70'>
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
    <div className={`space-y-3 rounded-xl border p-4 ${getProductStatusPanelTone('neutral')}`}>
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
      <SectionHeader
        description='Actualizá el avance sin entrar a edición completa.'
        icon={Icons.adjustments}
        label='Estado comercial'
      />
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
