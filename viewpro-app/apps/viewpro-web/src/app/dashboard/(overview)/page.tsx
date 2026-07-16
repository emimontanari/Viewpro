'use client';

// WU-3 — metrics dashboard page.
// Design B (D7): direct apiRequest to viewpro-api — no Next.js BFF route.
// Loading / empty / error states per spec scenario 2+3 and D11.
import { useQuery } from '@tanstack/react-query';
import PageContainer from '@/components/layout/page-container';
import { Skeleton } from '@/components/ui/skeleton';
import { metricsSummaryOptions } from '@/features/metrics/api/queries';
import { MetricsSummaryCards } from '@/features/metrics/components/metrics-summary-cards';
import { getApiErrorMessage } from '@/lib/api-client';

function MetricsLoadingSkeleton() {
  return (
    <div data-testid='metrics-loading-skeleton' className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className='h-32 w-full rounded-xl' />
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, isError, error } = useQuery({
    ...metricsSummaryOptions,
    retry: false
  });

  return (
    <PageContainer
      pageTitle='Panel de control'
      pageDescription='Métricas de inmobiliarias en la plataforma ViewPro.'
    >
      {isLoading && <MetricsLoadingSkeleton />}

      {isError && (
        <div
          data-testid='metrics-error'
          className='rounded-xl border border-destructive/30 bg-destructive/5 p-6'
        >
          <p className='font-semibold text-destructive'>
            No se pudieron cargar las métricas
          </p>
          <p className='mt-1 text-sm text-muted-foreground'>
            {getApiErrorMessage(error)}
          </p>
        </div>
      )}

      {!isLoading && !isError && data && (
        <MetricsSummaryCards data={data} />
      )}
    </PageContainer>
  );
}
