import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ActivityFeedItem } from '@/features/activity/api/types';
import type {
  DashboardSummaryRange,
  DashboardSummaryResponse,
  DashboardSummaryTopProperty
} from '@/features/dashboard/api/types';
import {
  formatArgentinaDateTime,
  formatCount,
  getActivityDescription,
  getActivityTitle,
  getDashboardPropertyTitle,
  getEngagementHref,
  getRangeOption
} from './helpers';
import { DashboardRowActionLink, EmptyPanel, ManagerMetricCard } from './primitives';
import { ManagerPriorityPanel } from './priority-panel';
import { RangeSelector } from './range-selector';

export function ManagerSummary({
  data,
  onRangeChange,
  range
}: {
  data: DashboardSummaryResponse;
  onRangeChange: (range: DashboardSummaryRange) => void;
  range: DashboardSummaryRange;
}) {
  const { activeProperties, attentionNeeded, movementsInRange, staleProperties } = data.counters;
  const { days } = getRangeOption(range);

  return (
    <div className='space-y-6'>
      <Card className='overflow-hidden border-primary/30 bg-primary py-0 text-primary-foreground shadow-md'>
        <CardContent className='space-y-4 p-5 sm:p-6'>
          <div className='space-y-1'>
            <h2 className='text-xl font-semibold tracking-tight'>Resumen operativo</h2>
            <p className='text-sm text-primary-foreground/80'>
              {activeProperties} gestiones activas y {movementsInRange} movimientos en los últimos {days}{' '}
              días.
            </p>
          </div>
          <div
            role='group'
            aria-label='Período del resumen operativo'
            className='rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 p-1'
          >
            <RangeSelector selectedRange={range} onSelectRange={onRangeChange} />
          </div>
        </CardContent>
      </Card>

      <div
        role='list'
        aria-label='Métricas del resumen operativo'
        className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'
      >
        <ManagerMetricCard
          helper='Gestiones activas, sin archivar y sin cerrar ni cancelar.'
          icon={Icons.product}
          label='Propiedades activas'
          tone='active'
          value={activeProperties}
          zeroCopy='No hay gestiones activas en este resumen.'
        />
        <ManagerMetricCard
          helper={`Movimientos creados en gestiones activas durante los últimos ${days} días.`}
          icon={Icons.trendingUp}
          label='Movimientos del período'
          tone='movements'
          value={movementsInRange}
          zeroCopy={`No hubo movimientos en los últimos ${days} días.`}
        />
        <ManagerMetricCard
          helper={`Gestiones activas sin movimientos creados en los últimos ${days} días.`}
          icon={Icons.clock}
          label={`Sin novedades en ${days} días`}
          tone='stale'
          value={staleProperties}
          zeroCopy={`No hay gestiones sin novedades en ${days} días.`}
        />
        <ManagerMetricCard
          helper='Gestiones activas cuya última consulta, visita completada u oferta recibida del período no tiene próximo paso significativo.'
          icon={Icons.warning}
          label='Requieren atención'
          tone='attention'
          value={attentionNeeded}
          zeroCopy='No hay gestiones que requieran atención.'
        />
      </div>

      <ManagerPriorityPanel attentionCount={attentionNeeded} rangeDays={days} staleCount={staleProperties} />
    </div>
  );
}

export function ManagerRecentActivity({
  items,
  unavailable = false
}: {
  items?: ActivityFeedItem[];
  unavailable?: boolean;
}) {
  if (unavailable) return <ManagerUnavailablePanel title='Actividad reciente no disponible' />;

  const activity = items?.slice(0, 5) ?? [];

  return (
    <Card className='py-0'>
      <CardHeader className='flex flex-row items-start justify-between gap-3 p-5 pb-0'>
        <div>
          <CardTitle role='heading' aria-level={2}>Actividad reciente</CardTitle>
          <p className='mt-1 text-sm text-muted-foreground'>Movimientos y solicitudes documentales del período.</p>
        </div>
        <Button asChild variant='outline' size='sm'>
          <Link href='/dashboard/seguimiento'>Ver todo</Link>
        </Button>
      </CardHeader>
      <CardContent className='p-5'>
        {activity.length === 0 ? (
          <EmptyPanel icon={Icons.clock} title='Sin movimientos recientes' description='Cuando haya movimientos o solicitudes documentales, van a aparecer acá.' />
        ) : (
          <ol aria-label='Actividad reciente' className='space-y-3'>
            {activity.map((item) => {
              const title = getActivityTitle(item);
              const href = getEngagementHref(item.property.engagementId);
              return (
                <li key={item.id} className='rounded-2xl border bg-muted/20 p-3'>
                  <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                    <div className='min-w-0 space-y-1'>
                      <Badge variant='outline' className='rounded-full bg-background'>
                        {item.kind === 'document_request' ? 'Documento' : 'Movimiento'}
                      </Badge>
                      <p className='break-words font-medium'>{title}</p>
                      <p className='break-words text-sm text-muted-foreground'>{getActivityDescription(item)}</p>
                      <time className='block text-sm text-muted-foreground' dateTime={item.createdAt}>
                        {formatArgentinaDateTime(item.createdAt)}
                      </time>
                    </div>
                    {href ? <DashboardRowActionLink href={href} ariaLabel={`Abrir actividad: ${title}`} /> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export function ManagerTopProperties({
  properties,
  unavailable = false
}: {
  properties?: DashboardSummaryTopProperty[];
  unavailable?: boolean;
}) {
  if (unavailable) return <ManagerUnavailablePanel title='Propiedades con más movimiento no disponibles' />;

  const rankings = properties?.slice(0, 3) ?? [];

  return (
    <Card className='py-0'>
      <CardHeader className='p-5 pb-0'>
        <CardTitle role='heading' aria-level={2}>Propiedades con más movimiento</CardTitle>
        <p className='mt-1 text-sm text-muted-foreground'>Basado en movimientos y documentos del período.</p>
      </CardHeader>
      <CardContent className='p-5'>
        {rankings.length === 0 ? (
          <EmptyPanel icon={Icons.product} title='Sin actividad para comparar' description='Cuando se registren movimientos, vas a ver qué propiedades concentraron más actividad en el período.' />
        ) : (
          <ol aria-label='Propiedades con más movimiento' className='space-y-3'>
            {rankings.map((property) => {
              const title = getDashboardPropertyTitle(property);
              const href = getEngagementHref(property.engagementId);
              return (
                <li key={property.engagementId} className='rounded-2xl border bg-muted/20 p-3'>
                  <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                    <div className='min-w-0 space-y-1'>
                      <p className='break-words font-medium'>{title}</p>
                      <p className='text-sm text-muted-foreground'>
                        {formatCount(property.movementCount, 'movimiento', 'movimientos')} · {formatCount(property.documentRequestCount, 'documento', 'documentos')}
                      </p>
                      <p className='break-words text-sm text-muted-foreground'>Último: {property.lastActivityTitle}</p>
                      <time className='block text-sm text-muted-foreground' dateTime={property.lastActivityAt}>
                        {formatArgentinaDateTime(property.lastActivityAt)}
                      </time>
                    </div>
                    {href ? <DashboardRowActionLink href={href} ariaLabel={`Abrir propiedad ${title}`} /> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function ManagerUnavailablePanel({ title }: { title: string }) {
  return (
    <Card className='py-0'>
      <CardContent className='p-5'>
        <p className='font-medium'>{title}</p>
        <p className='mt-1 text-sm text-muted-foreground'>El resumen operativo no pudo cargarse.</p>
      </CardContent>
    </Card>
  );
}
