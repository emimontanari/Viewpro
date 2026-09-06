import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardSummaryOptions } from '@/features/dashboard/api/queries';
import type {
  DashboardSummaryRange,
  DashboardSummaryResponse
} from '@/features/dashboard/api/types';

export type ManagerSummaryState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void; retrying: boolean }
  | { status: 'ready'; data: DashboardSummaryResponse; refreshing: boolean };

export function ManagerSummaryGate({
  children,
  summary
}: {
  children: ReactNode;
  summary: ManagerSummaryState;
}) {
  return summary.status === 'ready' ? children : null;
}

export function useManagerSummary({
  range,
  tenantId
}: {
  range: DashboardSummaryRange;
  tenantId: string;
}): ManagerSummaryState {
  const query = useQuery({
    ...dashboardSummaryOptions({ range, tenantId }),
    enabled: Boolean(tenantId),
    refetchOnReconnect: false,
    refetchOnWindowFocus: false
  });

  if (query.isError) {
    return {
      retry: () => void query.refetch(),
      retrying: query.isFetching,
      status: 'error'
    };
  }

  if (query.isLoading || !query.isSuccess || !query.data) {
    return { status: 'loading' };
  }

  return { data: query.data, refreshing: query.isFetching, status: 'ready' };
}
