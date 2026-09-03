import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';

vi.mock('../../api/service', () => ({ demandPlatformSync: vi.fn() }));

import { metricsKeys } from '@/features/metrics/api/queries';
import { demandPlatformSync } from '../../api/service';
import type { PlatformSyncStatus } from '../../api/types';
import { PlatformSyncProvider } from '../platform-sync-provider';

const mockDemand = vi.mocked(demandPlatformSync);
const projectionKey = metricsKeys.summary();

function makeStatus(overrides: Partial<PlatformSyncStatus> = {}): PlatformSyncStatus {
  return {
    state: 'updating',
    inFlight: true,
    attemptCount: 1,
    consecutiveFailureCount: 0,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastObservedCursor: null,
    lastBatchCount: null,
    failureCode: null,
    ...overrides
  };
}

function ProjectionConsumer({ queryFn }: { queryFn: () => Promise<{ label: string }> }) {
  const { data } = useQuery({
    queryKey: projectionKey,
    queryFn,
    staleTime: Infinity,
    refetchOnWindowFocus: false
  });

  return <output>{data?.label}</output>;
}

describe('PlatformSyncProvider projection freshness', () => {
  afterEach(() => {
    vi.useRealTimers();
    mockDemand.mockReset();
  });

  it('renders the matching durable projection by fake-clock t0+9s while status remains updating', async () => {
    vi.useFakeTimers();
    let resolveDemand!: (status: PlatformSyncStatus) => void;
    const queryFn = vi.fn(async () => ({ label: 'new projection' }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(projectionKey, { label: 'old projection' });
    mockDemand.mockResolvedValueOnce(makeStatus()).mockImplementationOnce(
      () =>
        new Promise<PlatformSyncStatus>((resolve) => {
          resolveDemand = resolve;
        })
    );

    render(
      <QueryClientProvider client={queryClient}>
        <PlatformSyncProvider>
          <ProjectionConsumer queryFn={queryFn} />
        </PlatformSyncProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText('old projection')).toBeTruthy();

    await act(async () => vi.advanceTimersByTimeAsync(0)); // t0: prior demand has no durable batch
    await act(async () => vi.advanceTimersByTimeAsync(4000)); // t0+4s: visible cadence demand
    await act(async () => vi.advanceTimersByTimeAsync(4000)); // t0+8s: durable batch returns
    await act(async () => {
      resolveDemand(makeStatus({ lastBatchCount: 1, lastObservedCursor: 42 }));
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => vi.advanceTimersByTimeAsync(1000)); // t0+9s: invalidation/refetch/render budget

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(screen.getByText('new projection')).toBeTruthy();
    expect(screen.getByTestId('platform-sync-status-badge')).toHaveTextContent(
      'Sincronizando datos…'
    );
  });
});
