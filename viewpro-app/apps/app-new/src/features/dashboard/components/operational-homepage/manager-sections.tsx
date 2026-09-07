import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ActivityFeedItem } from '@/features/activity/api/types';
import type { DashboardSummaryRange, DashboardSummaryResponse } from '@/features/dashboard/api/types';
import {
  formatArgentinaActivityTime,
  getActivityPropertyTitle,
  getActivityTitle,
  getDashboardEngagementHref,
  getRangeOption
} from './helpers';
import type { ManagerSummaryState } from './manager-home';
import { DashboardRowActionLink, EmptyPanel, ListSkeleton, ManagerMetricCard } from './primitives';
import { ManagerPriorityPanel } from './priority-panel';
import { RangeSelector } from './range-selector';

export function ManagerUnavailablePanel({
  retry,
  retrying,
  title
}: {
  retry: () => void;
  retrying: boolean;
  title: string;
}) {
  return (
    <div className='rounded-2xl border border-dashed p-5'>
      <p className='font-semibold'>{title}</p>
      <p className='mt-1 text-sm text-muted-foreground'>
        No mostramos datos anteriores como actuales.
      </p>
      <Button className='mt-4' disabled={retrying} onClick={retry}>
        {retrying ? 'Reintentando resumen' : 'Reintentar resumen'}
      </Button>
    </div>
  );
}

export function ManagerRecentActivity({
  range,
  summary
}: {
  range: DashboardSummaryRange;
  summary: ManagerSummaryState;
}) {
  const { days } = getRangeOption(range);
  const content =
    summary.status === 'loading' ? (
      <ListSkeleton rows={5} />
    ) : summary.status === 'error' ? (
      <ManagerUnavailablePanel
        retry={summary.retry}
        retrying={summary.retrying}
        title='Actividad reciente no disponible'
      />
    ) : summary.data.recentActivity.length === 0 ? (
      <EmptyPanel
        description={`No hubo movimientos ni solicitudes documentales en los últimos ${days} días.`}
        icon={Icons.clock}
        title='Sin movimientos recientes'
      />
    ) : (
      <ManagerRecentActivityRows items={summary.data.recentActivity.slice(0, 5)} />
    );

  return (
    <Card className='py-0'>
      <CardHeader className='flex flex-col gap-2 p-5 pb-0 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <CardTitle role='heading' aria-level={2}>
            Actividad reciente
          </CardTitle>
          <p className='mt-1 text-sm text-muted-foreground'>
            Movimientos y solicitudes documentales de los últimos {days} días.
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Badge variant='outline' className='w-fit rounded-full bg-muted/40'>
            Últimos {days} días
          </Badge>
          <Button asChild variant='outline' size='sm'>
            <Link href='/dashboard/seguimiento'>Ver todo</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className='p-5'>{content}</CardContent>
    </Card>
  );
}

function ManagerRecentActivityRows({ items }: { items: ActivityFeedItem[] }) {
  return (
    <ol className='space-y-3'>
      {items.map((item) => {
        const title = getActivityTitle(item);
        const engagementHref = getDashboardEngagementHref(item.property.engagementId);
        const timestamp = formatArgentinaActivityTime(item.createdAt);

        return (
          <li key={item.id} className='rounded-2xl border bg-muted/20 p-3'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <div className='min-w-0 space-y-1'>
                <Badge variant='outline' className='rounded-full bg-background'>
                  {item.kind === 'document_request' ? 'Documento' : 'Movimiento'}
                </Badge>
                <p className='break-words font-medium'>{title}</p>
                <p className='break-words text-sm text-muted-foreground'>
                  {getActivityPropertyTitle(item.property)}
                </p>
                {timestamp ? (
                  <time className='block text-sm text-muted-foreground' dateTime={timestamp.dateTime}>
                    {timestamp.label}
                  </time>
                ) : null}
              </div>
              {engagementHref ? (
                <DashboardRowActionLink
                  ariaLabel={`Abrir actividad: ${title}`}
                  href={engagementHref}
                />
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

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
