'use client';

// Operator console overview — starter-style charts dashboard fed by REAL
// ViewPro data (no mock/demo data). Design B (D7): direct apiRequest to
// viewpro-api via the existing metrics + tenants queries — no Next.js BFF route.
// Owns loading / empty / error states; the charts live in OverviewDashboard.
import { useQuery } from '@tanstack/react-query';
import PageContainer from '@/components/layout/page-container';
import { Skeleton } from '@/components/ui/skeleton';
import { metricsSummaryOptions } from '@/features/metrics/api/queries';
import { tenantsListOptions } from '@/features/tenants/api/queries';
import { revenueSummaryOptions } from '@/features/payments/api/queries';
import { OverviewDashboard } from '@/features/overview/components/overview-dashboard';
import { getApiErrorMessage } from '@/lib/api-client';

// Pull the full tenant base for client-side aggregation (plan coverage). The
// operator base is small; one page is enough to aggregate accurately.
const TENANT_AGGREGATION_LIMIT = 100;

function OverviewLoadingSkeleton() {
  return (
    <div data-testid='overview-loading-skeleton' className='flex flex-col gap-4'>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className='h-28 w-full rounded-xl' />
        ))}
      </div>
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        <Skeleton className='h-80 w-full rounded-xl' />
        <Skeleton className='h-80 w-full rounded-xl' />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const metricsQuery = useQuery({ ...metricsSummaryOptions, retry: false });
  const tenantsQuery = useQuery({
    ...tenantsListOptions(0, TENANT_AGGREGATION_LIMIT),
    retry: false
  });
  // Money is additive to the overview: if this query fails the dashboard still
  // renders, it just shows no revenue panel.
  const revenueQuery = useQuery({ ...revenueSummaryOptions, retry: false });

  const isLoading = metricsQuery.isLoading || tenantsQuery.isLoading;
  const isError = metricsQuery.isError || tenantsQuery.isError;
  const error = metricsQuery.error ?? tenantsQuery.error;
  const ready = !isLoading && !isError && metricsQuery.data && tenantsQuery.data;

  return (
    <PageContainer
      pageTitle='Panel de control'
      pageDescription='Métricas de inmobiliarias en la plataforma ViewPro.'
    >
      {isLoading && <OverviewLoadingSkeleton />}

      {isError && (
        <div
          data-testid='overview-error'
          className='border-destructive/30 bg-destructive/5 rounded-xl border p-6'
        >
          <p className='text-destructive font-semibold'>No se pudieron cargar las métricas</p>
          <p className='text-muted-foreground mt-1 text-sm'>{getApiErrorMessage(error)}</p>
        </div>
      )}

      {ready && (
        <OverviewDashboard
          metrics={metricsQuery.data}
          tenants={tenantsQuery.data.items}
          revenue={revenueQuery.data} />
      )}
    </PageContainer>
  );
}
