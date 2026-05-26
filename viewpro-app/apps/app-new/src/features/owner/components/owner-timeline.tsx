'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { ownerEngagementTimelineOptions } from '../api/queries';
import type { OwnerMovement, OwnerTimelineFilters } from '../api/types';

const DEFAULT_TIMELINE_FILTERS: Required<OwnerTimelineFilters> = {
  order: 'desc',
  page: 1,
  pageSize: 10
};

export function OwnerTimeline({ engagementId }: { engagementId: string }) {
  const timelineQuery = useQuery(ownerEngagementTimelineOptions(engagementId, DEFAULT_TIMELINE_FILTERS));

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
        <OwnerTimelineItem key={movement.id} movement={movement} />
      ))}
    </div>
  );
}

function OwnerTimelineItem({ movement }: { movement: OwnerMovement }) {
  return (
    <Card className='gap-4 py-4 shadow-none'>
      <CardHeader className='gap-3 px-4 sm:px-5'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div className='min-w-0 space-y-1'>
            <CardTitle className='text-base break-words'>{getMovementTypeLabel(movement.type)}</CardTitle>
            <p className='text-sm text-muted-foreground'>
              {formatDate(movement.createdAt)} · {movement.createdBy.firstName || movement.createdBy.email}
            </p>
          </div>
          {movement.newStatus ? <Badge variant='outline'>{getStatusLabel(movement.newStatus)}</Badge> : null}
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
            <span className='rounded-full border px-2 py-1'>{movement.interestCount} interesados</span>
          ) : null}
          {movement.visitCount !== null ? (
            <span className='rounded-full border px-2 py-1'>{movement.visitCount} visitas</span>
          ) : null}
          {movement.interestLevel ? (
            <span className='rounded-full border px-2 py-1'>Interés {getInterestLabel(movement.interestLevel)}</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function getMovementTypeLabel(type: string) {
  const labels: Record<string, string> = {
    ARCHIVED: 'Archivada',
    DOCUMENTATION_UPDATE: 'Documentación',
    GENERAL_UPDATE: 'Actualización general',
    INQUIRY: 'Consulta',
    OFFER_RECEIVED: 'Oferta recibida',
    RESTORED: 'Restaurada',
    STATUS_CHANGE: 'Cambio de estado',
    VISIT_COMPLETED: 'Visita realizada',
    VISIT_SCHEDULED: 'Visita programada'
  };

  return labels[type] ?? type;
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE_PUBLICATION: 'Publicación activa',
    CANCELLED: 'Cancelada',
    CAPTURE: 'Captación',
    CLOSED: 'Cerrada',
    DOCUMENTATION_PENDING: 'Documentación pendiente',
    FINAL_DOCUMENTATION: 'Documentación final',
    INQUIRIES_AND_VISITS: 'Consultas y visitas',
    OFFER_NEGOTIATION: 'Negociación',
    PUBLICATION_PREPARATION: 'Preparando publicación',
    RESERVATION_STARTED: 'Reserva iniciada'
  };

  return labels[status] ?? status;
}

function getInterestLabel(level: string) {
  const labels: Record<string, string> = {
    HIGH: 'alto',
    LOW: 'bajo',
    MEDIUM: 'medio'
  };

  return labels[level] ?? level.toLowerCase();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value));
}
