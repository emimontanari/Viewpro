import { Icons } from '@/components/icons';
import { Card, CardContent } from '@/components/ui/card';
import type { DashboardSummaryRange, DashboardSummaryResponse } from '@/features/dashboard/api/types';
import { getRangeOption } from './helpers';
import { ManagerMetricCard } from './primitives';
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
