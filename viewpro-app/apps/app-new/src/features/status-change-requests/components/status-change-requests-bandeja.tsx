'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { StatusChangeRequest } from '../api/types';

type StatusChangeRequestsBandejaProps = {
  requests: StatusChangeRequest[];
  isLoading: boolean;
  onApprove: (requestId: string, engagementId: string) => void;
  onReject: (requestId: string, engagementId: string) => void;
};

const CAP = 200;

export function StatusChangeRequestsBandeja({
  requests,
  isLoading,
  onApprove,
  onReject
}: StatusChangeRequestsBandejaProps) {
  if (isLoading) {
    return (
      <div aria-busy='true' aria-label='Cargando solicitudes'>
        <Skeleton className='h-12 w-full' />
        <Skeleton className='mt-2 h-12 w-full' />
        <Skeleton className='mt-2 h-12 w-full' />
      </div>
    );
  }

  // Filter to PENDING only — optimistic updates may leave RESOLVED items in the cache
  const pendingRequests = requests.filter((r) => r.status === 'PENDING');

  if (pendingRequests.length === 0) {
    return (
      <div className='text-muted-foreground py-8 text-center text-sm'>
        No hay solicitudes pendientes.
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-4'>
      {/* 200-cap banner */}
      {requests.length >= CAP && (
        <div
          role='alert'
          className='rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
        >
          Mostrando las 200 solicitudes más recientes. Más antiguas no son visibles aún.
        </div>
      )}

      <div className='overflow-x-auto rounded-md border'>
        <table className='w-full text-sm' aria-label='Solicitudes de cambio de estado pendientes'>
          <thead>
            <tr className='border-b bg-muted/50'>
              <th scope='col' className='px-4 py-3 text-left font-medium'>Propiedad</th>
              <th scope='col' className='px-4 py-3 text-left font-medium'>Estado</th>
              <th scope='col' className='px-4 py-3 text-left font-medium'>Solicitado por</th>
              <th scope='col' className='px-4 py-3 text-left font-medium'>Nota</th>
              <th scope='col' className='px-4 py-3 text-left font-medium'>Fecha</th>
              <th scope='col' className='px-4 py-3 text-left font-medium'>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pendingRequests.map((request) => (
              <BandejaRow
                key={request.id}
                request={request}
                onApprove={onApprove}
                onReject={onReject}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BandejaRow({
  request,
  onApprove,
  onReject
}: {
  request: StatusChangeRequest;
  onApprove: (requestId: string, engagementId: string) => void;
  onReject: (requestId: string, engagementId: string) => void;
}) {
  const propertyTitle = request.propertyTitle ?? request.propertyEngagementId;
  const requesterName = request.requestedByUserId;
  const timeAgo = formatTimeAgo(request.createdAt);

  return (
    <tr
      className='border-b last:border-0 hover:bg-muted/30'
      aria-label={`${propertyTitle} a ${request.targetStatus}, solicitado por ${requesterName}`}
    >
      <td className='px-4 py-3 font-medium'>{propertyTitle}</td>
      <td className='px-4 py-3' aria-label={`Estado: ${request.currentStatusSnapshot} a ${request.targetStatus}`}>
        <div className='flex items-center gap-2' role='presentation'>
          <Badge variant='outline' className='text-xs'>
            {request.currentStatusSnapshot}
          </Badge>
          <span aria-hidden='true'>→</span>
          <Badge variant='default' className='text-xs'>
            {request.targetStatus}
          </Badge>
        </div>
      </td>
      <td className='px-4 py-3 text-muted-foreground'>{requesterName}</td>
      <td className='px-4 py-3 text-muted-foreground'>
        {request.requestNote ? (
          <span className='line-clamp-2'>{request.requestNote}</span>
        ) : (
          <span className='text-muted-foreground/50'>—</span>
        )}
      </td>
      <td className='px-4 py-3'>
        <time dateTime={request.createdAt} title={request.createdAt}>
          {timeAgo}
        </time>
      </td>
      <td className='px-4 py-3'>
        <div className='flex gap-2'>
          <Button
            size='sm'
            onClick={() => onApprove(request.id, request.propertyEngagementId)}
            aria-label={`Aprobar solicitud de ${propertyTitle}`}
          >
            Aprobar
          </Button>
          <Button
            size='sm'
            variant='destructive'
            onClick={() => onReject(request.id, request.propertyEngagementId)}
            aria-label={`Rechazar solicitud de ${propertyTitle}`}
          >
            Rechazar
          </Button>
        </div>
      </td>
    </tr>
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
