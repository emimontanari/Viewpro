import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ProductListItem } from '../../api/types';
import {
  getAddress,
  getAgentSummary,
  getArchivedTone,
  getPropertyFacts,
  isArchivedProduct
} from './columns';

export function PropertyIdentity({
  compact = false,
  propertyEngagement
}: {
  compact?: boolean;
  propertyEngagement: ProductListItem;
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

export function OwnerSummary({
  mobile = false,
  propertyEngagement
}: {
  mobile?: boolean;
  propertyEngagement: ProductListItem;
}) {
  const ownerName = propertyEngagement.property.ownerName ?? 'Sin nombre';
  const ownerEmail = propertyEngagement.property.ownerEmail;

  if (mobile) {
    return (
      <PropertyMetric label='Propietario' value={ownerName} mutedValue={ownerEmail ?? undefined} />
    );
  }

  return (
    <div className='max-w-48'>
      <p className='truncate text-sm font-medium'>{ownerName}</p>
      <p className='truncate text-xs text-muted-foreground'>{ownerEmail ?? 'Sin email'}</p>
    </div>
  );
}

export function SellerSummary({
  mobile = false,
  propertyEngagement
}: {
  mobile?: boolean;
  propertyEngagement: ProductListItem;
}) {
  const agent = getAgentSummary(propertyEngagement);

  if (mobile) {
    return <PropertyMetric label='Vendedor' value={agent.label} mutedValue={agent.detail} />;
  }

  return (
    <div className='max-w-36'>
      <p className='truncate text-sm font-medium'>{agent.label}</p>
      <p className='truncate text-xs text-muted-foreground'>{agent.detail}</p>
    </div>
  );
}

export function PropertyMetric({
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
  propertyEngagement: ProductListItem;
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
