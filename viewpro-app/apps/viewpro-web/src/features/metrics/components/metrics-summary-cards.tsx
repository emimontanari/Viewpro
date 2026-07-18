'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MetricsSummary } from '@/features/metrics/api/types';
import { MetricsEmptyState } from './metrics-empty-state';

type Props = {
  data: MetricsSummary;
};

/**
 * Renders the operator metrics dashboard cards.
 *
 * Empty state: when tenants===0 renders MetricsEmptyState (D11, spec scenario 2).
 * byStatus: iterated dynamically — no closed enum (D11).
 */
export function MetricsSummaryCards({ data }: Props) {
  const { tenants, byStatus, generatedAt } = data;

  if (tenants === 0) {
    return <MetricsEmptyState />;
  }

  const statusEntries = Object.entries(byStatus);

  return (
    <div className='flex flex-col gap-6'>
      {/* Total tenants card */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        <Card>
          <CardHeader>
            <CardTitle className='text-sm font-medium text-muted-foreground'>
              Total de inmobiliarias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              data-testid='total-tenants-count'
              className='text-3xl font-bold'
            >
              {tenants}
            </p>
          </CardContent>
        </Card>

        {/* Per-status breakdown (D11 — open map) */}
        {statusEntries.map(([status, count]) => (
          <Card key={status}>
            <CardHeader>
              <CardTitle className='text-sm font-medium capitalize text-muted-foreground'>
                {status}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                data-testid={`status-${status}`}
                className='text-3xl font-bold'
              >
                {count}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* generatedAt footer */}
      <p
        data-testid='generated-at'
        className='text-muted-foreground text-xs'
      >
        Generado a las{' '}
        {new Date(generatedAt).toLocaleString('es-AR', {
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
