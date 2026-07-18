'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import type { MetricsSummary } from '@/features/metrics/api/types';
import type { TenantListItem } from '@/features/tenants/api/types';
import { overviewStats } from '../lib/aggregations';

type Props = {
  metrics: MetricsSummary;
  tenants: TenantListItem[];
};

/**
 * Top KPI row — real figures derived from metrics + the tenant list.
 * Total is authoritative from metrics; active/trial come from the status map;
 * plan coverage is counted from the tenant list.
 */
export function OverviewStatCards({ metrics, tenants }: Props) {
  const stats = overviewStats(metrics, tenants);

  const cards = [
    {
      testId: 'stat-total',
      label: 'Total de inmobiliarias',
      value: stats.total,
      Icon: Icons.teams
    },
    {
      testId: 'stat-active',
      label: 'Activas',
      value: stats.active,
      Icon: Icons.check
    },
    {
      testId: 'stat-trial',
      label: 'En trial',
      value: stats.trial,
      Icon: Icons.clock
    },
    {
      testId: 'stat-with-plan',
      label: 'Con plan asignado',
      value: stats.withPlan,
      Icon: Icons.billing
    }
  ];

  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
      {cards.map(({ testId, label, value, Icon }) => (
        <Card key={testId} className='@container/card'>
          <CardHeader className='flex flex-row items-center justify-between gap-2 space-y-0'>
            <CardTitle className='text-muted-foreground text-sm font-medium'>{label}</CardTitle>
            <Icon className='text-muted-foreground size-4 shrink-0' />
          </CardHeader>
          <CardContent>
            <p data-testid={testId} className='text-3xl font-bold tabular-nums'>
              {value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
