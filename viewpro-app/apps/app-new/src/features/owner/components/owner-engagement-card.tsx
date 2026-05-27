import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { OwnerEngagement } from '../api/types';
import { OwnerStatusPath } from './owner-status-path';
import { OwnerTimeline } from './owner-timeline';

export function OwnerEngagementCard({ engagement }: { engagement: OwnerEngagement }) {
  return (
    <Card className='overflow-hidden'>
      <CardHeader className='space-y-4'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div className='space-y-1'>
            <CardTitle className='text-xl'>Gestión con {engagement.tenant.name}</CardTitle>
            <p className='text-sm text-muted-foreground'>
              {getOperationTypeLabel(engagement.operationType)} ·{' '}
              {formatMoney(engagement.publishedPriceCents, engagement.currency)}
            </p>
          </div>
          <Badge>{getStatusLabel(engagement.status)}</Badge>
        </div>
      </CardHeader>
      <CardContent className='space-y-5'>
        <div className='rounded-xl bg-muted/40 p-4'>
          <p className='text-sm font-medium'>Equipo asignado</p>
          {engagement.agents.length > 0 ? (
            <ul className='mt-3 grid gap-2 sm:grid-cols-2'>
              {engagement.agents.map((agent) => (
                <li
                  key={agent.userId}
                  className='rounded-lg border bg-background px-3 py-2 text-sm'
                >
                  <p className='font-medium'>{agent.firstName || agent.email}</p>
                  <p className='break-all text-muted-foreground'>{agent.email}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className='mt-2 text-sm text-muted-foreground'>
              La inmobiliaria todavía no informó agentes asignados.
            </p>
          )}
        </div>

        <div className='space-y-4'>
          <OwnerStatusPath status={engagement.status} />
          <div className='space-y-3'>
            <div>
              <h2 className='text-lg font-semibold'>Movimientos recientes</h2>
              <p className='text-sm text-muted-foreground'>
                Últimos movimientos visibles para propietarios.
              </p>
            </div>
            <OwnerTimeline engagementId={engagement.id} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getOperationTypeLabel(operationType: string) {
  const labels: Record<string, string> = {
    RENT: 'Alquiler',
    SALE: 'Venta'
  };

  return labels[operationType] ?? operationType;
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

function formatMoney(amountCents: number, currency: string) {
  return new Intl.NumberFormat('es-AR', {
    currency,
    maximumFractionDigits: 0,
    style: 'currency'
  }).format(amountCents / 100);
}
