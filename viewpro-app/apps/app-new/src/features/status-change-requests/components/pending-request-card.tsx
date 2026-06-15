'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { StatusChangeRequest } from '../api/types';

type PendingRequestCardProps = {
  request: StatusChangeRequest;
  propertyTitle: string;
  requesterName: string;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
};

export function PendingRequestCard({
  request,
  propertyTitle,
  requesterName,
  onApprove,
  onReject
}: PendingRequestCardProps) {
  const timeAgo = formatTimeAgo(request.createdAt);

  return (
    <Card
      role='region'
      aria-label={`Solicitud de cambio de estado para ${propertyTitle}`}
    >
      <CardHeader className='pb-2'>
        <div className='flex items-center justify-between gap-2'>
          <span className='text-sm font-medium'>{propertyTitle}</span>
          <Badge
            variant='secondary'
            className='bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
            aria-label='Pending approval'
          >
            Solicitud pendiente
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className='flex flex-col gap-2'>
          {/* Status transition */}
          <div className='flex items-center gap-2 text-sm'>
            <Badge variant='outline'>{request.currentStatusSnapshot}</Badge>
            <span aria-hidden='true'>→</span>
            <Badge variant='default'>{request.targetStatus}</Badge>
          </div>

          {/* Requester */}
          <div className='text-muted-foreground text-xs'>
            Solicitado por <span className='font-medium text-foreground'>{requesterName}</span>
            {' · '}
            <time dateTime={request.createdAt}>{timeAgo}</time>
          </div>

          {/* Note */}
          {request.requestNote && (
            <p className='text-sm text-muted-foreground'>{request.requestNote}</p>
          )}

          {/* Actions */}
          <div className='flex gap-2 pt-1'>
            <Button
              size='sm'
              onClick={() => onApprove(request.id)}
              aria-label={`Aprobar solicitud de cambio de estado a ${request.targetStatus}`}
            >
              Aprobar
            </Button>
            <Button
              size='sm'
              variant='destructive'
              onClick={() => onReject(request.id)}
              aria-label={`Rechazar solicitud de cambio de estado a ${request.targetStatus}`}
            >
              Rechazar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatTimeAgo(isoDate: string): string {
  const date = new Date(isoDate);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffDays >= 1) return `Hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
  if (diffHours >= 1) return `Hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
  if (diffMinutes >= 1) return `Hace ${diffMinutes} minuto${diffMinutes !== 1 ? 's' : ''}`;
  return 'Hace un momento';
}
