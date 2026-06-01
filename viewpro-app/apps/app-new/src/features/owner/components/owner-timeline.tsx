'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { ownerEngagementTimelineOptions } from '../api/queries';
import { trackOwnerMovementWhatsappContactClick } from '../api/service';
import type { OwnerMovement, OwnerProperty, OwnerTimelineFilters } from '../api/types';
import {
  formatOwnerMovementShortDate,
  getOwnerMovementInterestLabel,
  getOwnerMovementStatusLabel,
  getOwnerMovementTypeLabel
} from '../utils/owner-movement-labels';
import { buildOwnerMovementWhatsappHref } from '../utils/owner-whatsapp-contact';

const DEFAULT_TIMELINE_FILTERS: Required<OwnerTimelineFilters> = {
  order: 'desc',
  page: 1,
  pageSize: 10
};

type OwnerTimelinePropertyContext = Pick<OwnerProperty, 'addressLine' | 'city' | 'province'>;

export function OwnerTimeline({
  engagementId,
  property
}: {
  engagementId: string;
  property: OwnerTimelinePropertyContext;
}) {
  const timelineQuery = useQuery(
    ownerEngagementTimelineOptions(engagementId, DEFAULT_TIMELINE_FILTERS)
  );

  if (timelineQuery.isLoading) {
    return <div className='h-32 animate-pulse rounded-xl bg-muted' />;
  }

  if (timelineQuery.isError) {
    return (
      <div className='rounded-xl border border-dashed p-4 text-sm text-muted-foreground'>
        No pudimos cargar el seguimiento de esta gestión.
      </div>
    );
  }

  const movements = timelineQuery.data?.items ?? [];

  if (movements.length === 0) {
    return (
      <div className='rounded-xl border border-dashed p-4 text-sm text-muted-foreground'>
        Todavía no hay movimientos visibles para esta gestión.
      </div>
    );
  }

  return (
    <div className='space-y-3'>
      {movements.map((movement) => (
        <OwnerTimelineItem key={movement.id} movement={movement} property={property} />
      ))}
    </div>
  );
}

function OwnerTimelineItem({
  movement,
  property
}: {
  movement: OwnerMovement;
  property: OwnerTimelinePropertyContext;
}) {
  const contactHref = buildOwnerMovementWhatsappHref({
    contact: movement.contact,
    movement,
    property
  });

  function handleContactClick() {
    if (!contactHref) {
      return;
    }

    void trackOwnerMovementWhatsappContactClick(movement.propertyEngagementId, movement.id).catch(
      () => undefined
    );
  }

  return (
    <Card className='gap-4 py-4 shadow-none'>
      <CardHeader className='gap-3 px-4 sm:px-5'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div className='min-w-0 space-y-1'>
            <CardTitle className='text-base break-words'>
              {getOwnerMovementTypeLabel(movement.type)}
            </CardTitle>
            <p className='text-sm text-muted-foreground'>
              {formatOwnerMovementShortDate(movement.createdAt)} ·{' '}
              {movement.createdBy.firstName || movement.createdBy.email}
            </p>
          </div>
          <div className='flex flex-col gap-2 sm:items-end'>
            {movement.newStatus ? (
              <Badge variant='outline'>{getOwnerMovementStatusLabel(movement.newStatus)}</Badge>
            ) : null}
            {contactHref ? (
              <Button asChild variant='outline' size='sm' className='w-fit'>
                <a
                  href={contactHref}
                  target='_blank'
                  rel='noopener noreferrer'
                  onClick={handleContactClick}
                >
                  {movement.contact.displayLabel}
                </a>
              </Button>
            ) : (
              <Button type='button' variant='outline' size='sm' className='w-fit' disabled>
                {movement.contact.displayLabel}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-3 px-4 sm:px-5'>
        <p className='text-sm leading-6 break-words'>{movement.observation}</p>
        {movement.nextStep ? (
          <div className='rounded-lg bg-muted/60 p-3 text-sm'>
            <span className='font-medium'>Próximo paso: </span>
            <span className='text-muted-foreground'>{movement.nextStep}</span>
          </div>
        ) : null}
        <div className='flex flex-wrap gap-2 text-xs text-muted-foreground'>
          {movement.interestCount !== null ? (
            <span className='rounded-full border px-2 py-1'>
              {movement.interestCount} interesados
            </span>
          ) : null}
          {movement.visitCount !== null ? (
            <span className='rounded-full border px-2 py-1'>{movement.visitCount} visitas</span>
          ) : null}
          {movement.interestLevel ? (
            <span className='rounded-full border px-2 py-1'>
              Interés {getOwnerMovementInterestLabel(movement.interestLevel)}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
