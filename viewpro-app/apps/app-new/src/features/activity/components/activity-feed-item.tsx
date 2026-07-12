import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getMovementTypeLabel } from '@/features/products/constants/movement-options';
import {
  getOperationTone,
  getOperationTypeLabel,
  getStatusLabel,
  getStatusTone
} from '@/features/products/components/product-tables/columns';
import { formatDateTime } from '@/features/products/utils/format-date-time';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ActivityMovementItem } from '../api/types';

export function ActivityFeedItem({
  item,
  onViewDetails
}: {
  item: ActivityMovementItem;
  onViewDetails: (item: ActivityMovementItem) => void;
}) {
  const propertyTitle = item.property.title?.trim() || 'Propiedad sin título';
  const address = formatAddress(item);
  const actor = item.createdBy.firstName || item.createdBy.email;
  const statusChange = getMovementStatusChange(item);
  const seller = getSellerLabel(item);
  const summaryLabel = statusChange ? 'Cambio de estado' : getMovementTypeLabel(item.type);
  const summaryValue = statusChange ?? item.observation;

  return (
    <Card className='overflow-hidden py-0 transition-colors hover:border-primary/30'>
      <CardContent className='p-0'>
        <div className='grid lg:grid-cols-[minmax(0,1fr)_13.5rem]'>
          <div className='space-y-4 p-4 sm:p-5'>
            <div className='flex gap-4'>
              <div className='hidden size-12 shrink-0 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground sm:flex'>
                <Icons.product className='size-6' />
              </div>
              <div className='min-w-0 flex-1 space-y-2'>
                <div className='flex flex-wrap items-center gap-2'>
                  <Badge variant='outline' className='rounded-full bg-muted/40'>
                    {getMovementTypeLabel(item.type)}
                  </Badge>
                  <Badge
                    variant='outline'
                    className={cn('rounded-full', getOperationTone(item.property.operationType))}
                  >
                    {getOperationTypeLabel(item.property.operationType)}
                  </Badge>
                  <Badge
                    variant='outline'
                    className={cn('rounded-full', getStatusTone(item.property.status))}
                  >
                    {getStatusLabel(item.property.status)}
                  </Badge>
                </div>
                <div className='min-w-0 space-y-1'>
                  <h3 className='line-clamp-2 break-words text-base font-semibold leading-snug'>
                    {propertyTitle}
                  </h3>
                  {address ? (
                    <p className='line-clamp-1 text-sm text-muted-foreground'>{address}</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className='grid gap-3 md:grid-cols-2'>
              <div className='min-w-0 rounded-xl border bg-muted/20 p-3'>
                <div className='flex items-center gap-2 text-xs font-medium text-muted-foreground'>
                  <Icons.chevronsUpDown className='size-4 shrink-0' />
                  {summaryLabel}
                </div>
                <p className='mt-1 line-clamp-2 break-words text-sm font-medium leading-6'>
                  {summaryValue}
                </p>
                {statusChange && item.observation ? (
                  <p className='mt-1 line-clamp-2 break-words text-xs leading-5 text-muted-foreground'>
                    {item.observation}
                  </p>
                ) : null}
              </div>

              <div className='min-w-0 rounded-xl border bg-muted/20 p-3'>
                <div className='flex items-center gap-2 text-xs font-medium text-muted-foreground'>
                  <Icons.arrowRight className='size-4 shrink-0' />
                  Próximo paso
                </div>
                <p className='mt-1 line-clamp-2 break-words text-sm font-medium leading-6'>
                  {item.nextStep || 'Sin próximo paso cargado'}
                </p>
              </div>
            </div>

            <div className='grid gap-3 border-t pt-3 text-sm text-muted-foreground sm:grid-cols-2'>
              <ActivityMeta
                icon={<Icons.user className='size-4' />}
                label='Registrado por'
                value={actor}
              />
              <ActivityMeta
                icon={<Icons.teams className='size-4' />}
                label='Vendedor'
                value={seller}
              />
            </div>
          </div>

          <div className='flex flex-col gap-3 border-t p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:flex-col lg:items-end lg:justify-start lg:border-l lg:border-t-0 lg:p-5'>
            <div className='flex items-center gap-2 whitespace-nowrap lg:justify-end'>
              <Icons.calendar className='size-4 shrink-0' />
              <time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
            </div>
            <div className='flex flex-wrap gap-2 sm:justify-end lg:w-full lg:flex-col'>
              <Button asChild variant='outline' size='sm' className='lg:w-full'>
                <Link href={`/dashboard/product/${item.property.engagementId}`}>
                  Ver propiedad
                  <Icons.arrowRight className='size-4' />
                </Link>
              </Button>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                className='lg:w-full'
                onClick={() => onViewDetails(item)}
              >
                Ver detalle
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityMeta({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className='flex min-w-0 items-center gap-2'>
      <span className='shrink-0 text-muted-foreground'>{icon}</span>
      <div className='min-w-0 space-y-0.5'>
        <p className='text-xs'>{label}</p>
        <p className='truncate font-medium text-foreground' title={value}>
          {value}
        </p>
      </div>
    </div>
  );
}

function getMovementStatusChange(item: ActivityMovementItem) {
  if (!item.newStatus) {
    return null;
  }

  const previousStatus = item.previousStatus
    ? getStatusLabel(item.previousStatus)
    : 'Sin estado anterior';
  return `${previousStatus} → ${getStatusLabel(item.newStatus)}`;
}

function formatAddress(item: ActivityMovementItem) {
  return [item.property.addressLine, item.property.city, item.property.province]
    .filter(Boolean)
    .join(', ');
}

function getSellerLabel(item: ActivityMovementItem) {
  if (item.property.agents.length === 0) {
    return 'Sin vendedor asignado';
  }

  const [firstAgent] = item.property.agents;
  const firstAgentName = firstAgent.firstName || firstAgent.email;

  if (item.property.agents.length === 1) {
    return firstAgentName;
  }

  return `${firstAgentName} + ${item.property.agents.length - 1} más`;
}
