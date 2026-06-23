'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
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
  pageSize: 25
};

type OwnerTimelinePropertyContext = Pick<OwnerProperty, 'addressLine' | 'city' | 'province'>;

export function OwnerTimeline({
  engagementId,
  highlightMovementId = null,
  property,
  scrollSectionOnMiss = true
}: {
  engagementId: string;
  highlightMovementId?: string | null;
  property: OwnerTimelinePropertyContext;
  scrollSectionOnMiss?: boolean;
}) {
  const timelineQuery = useQuery(
    ownerEngagementTimelineOptions(engagementId, DEFAULT_TIMELINE_FILTERS)
  );

  // Hooks declared BEFORE early returns (unconditional rule).
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount to avoid setState-after-unmount.
  useEffect(() => {
    return () => {
      if (highlightTimerRef.current !== null) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  // Scroll to and briefly highlight the target item after the query resolves (D5, D6, FR-F8, FR-F9).
  useEffect(() => {
    if (!highlightMovementId || !timelineQuery.isSuccess) {
      return;
    }

    const movements = timelineQuery.data?.items ?? [];
    const itemExists = movements.some((m) => m.id === highlightMovementId);

    if (itemExists) {
      // Hit path (D5): scroll to the element and apply highlight ring.
      const selector = `[data-movement-id="${CSS.escape(highlightMovementId)}"]`;
      const element = containerRef.current?.querySelector(selector);
      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setHighlightedId(highlightMovementId);

      if (highlightTimerRef.current !== null) {
        clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedId(null);
        highlightTimerRef.current = null;
      }, 2000);
    } else if (scrollSectionOnMiss) {
      // Miss path / section fallback (D6): scroll section into view, no highlight.
      // Gated by scrollSectionOnMiss so that with multiple engagements a non-matching
      // timeline does not section-scroll and fight the owning timeline's hit-path scroll.
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [highlightMovementId, timelineQuery.isSuccess, timelineQuery.data, scrollSectionOnMiss]);

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
    <div ref={containerRef} className='space-y-3'>
      {movements.map((movement) => (
        <OwnerTimelineItem
          key={movement.id}
          isHighlighted={highlightedId === movement.id}
          movement={movement}
          property={property}
        />
      ))}
    </div>
  );
}

function OwnerTimelineItem({
  isHighlighted,
  movement,
  property
}: {
  isHighlighted: boolean;
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
    <Card
      className={cn('gap-4 py-4 shadow-none', isHighlighted && 'ring-2 ring-primary')}
      data-movement-id={movement.id}
    >
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
