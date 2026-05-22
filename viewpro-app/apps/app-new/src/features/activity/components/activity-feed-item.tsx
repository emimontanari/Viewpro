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
import type { ActivityFeedItem } from '../api/types';

export function ActivityFeedItem({
  item,
  onViewDetails
}: {
  item: ActivityFeedItem;
  onViewDetails: (item: ActivityFeedItem) => void;
}) {
  const propertyTitle = item.property.title?.trim() || 'Propiedad sin título';
  const address = formatAddress(item);
  const actor = item.createdBy.firstName || item.createdBy.email;
  const statusChange = getMovementStatusChange(item);
  const agents = getAgentsLabel(item);

  return (
    <Card className='py-0 transition-colors hover:border-primary/30'>
      <CardContent className='space-y-4 p-4'>
        <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
          <div className='min-w-0 space-y-2'>
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
            <div>
              <h3 className='break-words text-base font-semibold'>{propertyTitle}</h3>
              {address ? <p className='text-sm text-muted-foreground'>{address}</p> : null}
            </div>
          </div>
          <div className='flex shrink-0 flex-col gap-2 text-sm text-muted-foreground lg:items-end'>
            <time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
            <div className='flex flex-wrap gap-2 lg:justify-end'>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                onClick={() => onViewDetails(item)}
              >
                Ver detalle
              </Button>
              <Button asChild variant='outline' size='sm'>
                <Link href={`/dashboard/product/${item.property.engagementId}`}>
                  Ver propiedad
                  <Icons.arrowRight className='size-4' />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {statusChange ? (
          <p className='text-sm font-medium text-muted-foreground'>{statusChange}</p>
        ) : null}

        <p className='line-clamp-2 break-words text-sm leading-6'>{item.observation}</p>

        <div className='grid gap-2 text-sm text-muted-foreground md:grid-cols-3'>
          <div className='flex min-w-0 items-center gap-2'>
            <Icons.user className='size-4 shrink-0' />
            <span className='truncate'>Registrado por {actor}</span>
          </div>
          <div className='flex min-w-0 items-center gap-2'>
            <Icons.teams className='size-4 shrink-0' />
            <span className='truncate'>{agents}</span>
          </div>
          <div className='flex min-w-0 items-center gap-2'>
            <Icons.arrowRight className='size-4 shrink-0' />
            <span className='truncate'>
              {item.nextStep ? `Próximo paso: ${item.nextStep}` : 'Sin próximo paso cargado'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getMovementStatusChange(item: ActivityFeedItem) {
  if (!item.newStatus) {
    return null;
  }

  const previousStatus = item.previousStatus
    ? getStatusLabel(item.previousStatus)
    : 'Sin estado anterior';
  return `${previousStatus} → ${getStatusLabel(item.newStatus)}`;
}

function formatAddress(item: ActivityFeedItem) {
  return [item.property.addressLine, item.property.city, item.property.province]
    .filter(Boolean)
    .join(', ');
}

function getAgentsLabel(item: ActivityFeedItem) {
  if (item.property.agents.length === 0) {
    return 'Sin vendedores asignados';
  }

  const [firstAgent] = item.property.agents;
  const firstAgentName = firstAgent.firstName || firstAgent.email;

  if (item.property.agents.length === 1) {
    return `Vendedor: ${firstAgentName}`;
  }

  return `Vendedores: ${firstAgentName} + ${item.property.agents.length - 1} más`;
}
