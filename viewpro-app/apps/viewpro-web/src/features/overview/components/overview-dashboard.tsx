'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { MetricsSummary } from '@/features/metrics/api/types';
import type { TenantListItem } from '@/features/tenants/api/types';
import { OverviewStatCards } from './overview-stat-cards';
import { StatusPieChart } from './status-pie-chart';
import { PlanBarChart } from './plan-bar-chart';

type Props = {
  metrics: MetricsSummary;
  tenants: TenantListItem[];
};

/**
 * Presentational charts dashboard — real ViewPro data in, panels out.
 * Fetching lives in the page; this stays pure so panels are trivially testable.
 *
 * Layout: a KPI stat row over a responsive grid of the status donut and the
 * plan bar chart. Zero tenants renders a graceful empty state (an expected
 * steady state, not an error) rather than empty charts.
 */
export function OverviewDashboard({ metrics, tenants }: Props) {
  if (metrics.tenants === 0) {
    return (
      <Card className='border-dashed'>
        <CardContent
          data-testid='overview-empty-state'
          className='flex flex-col items-center justify-center py-12 text-center'
        >
          <p className='text-muted-foreground text-lg font-medium'>Todavía no hay métricas</p>
          <p className='text-muted-foreground mt-1 text-sm'>
            Los gráficos aparecerán cuando se registren inmobiliarias en la plataforma.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='flex flex-col gap-4'>
      <OverviewStatCards metrics={metrics} tenants={tenants} />

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        <StatusPieChart byStatus={metrics.byStatus} />
        <PlanBarChart tenants={tenants} />
      </div>

      <p data-testid='overview-generated-at' className='text-muted-foreground text-xs'>
        Actualizado a las{' '}
        {new Date(metrics.generatedAt).toLocaleString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </p>
    </div>
  );
}
