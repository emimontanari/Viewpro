// C.1 — RED: usePlatformSyncDemand() fake-clock tests (AC2, AC4, AC6, AC9).
// Covers mount/focus/refresh, 4s cadence, hidden stop, 404 fallback, and the
// t0+9s (≤10s SLO) freshness oracle (invalidates without needing `current`).
import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../api/service', () => ({ demandPlatformSync: vi.fn() }));

import { demandPlatformSync } from '../../api/service';
import { usePlatformSyncDemand } from '../use-platform-sync-demand';
import type { PlatformSyncStatus } from '../../api/types';

const mockDemand = vi.mocked(demandPlatformSync);

function makeStatus(overrides: Partial<PlatformSyncStatus> = {}): PlatformSyncStatus {
  return {
    state: 'stale', inFlight: false, attemptCount: 0, consecutiveFailureCount: 0,
    lastAttemptAt: null, lastSuccessAt: null, lastFailureAt: null,
    lastObservedCursor: null, lastBatchCount: null, failureCode: null, ...overrides
  };
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
}

function renderWithClient() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { ...renderHook(() => usePlatformSyncDemand(), { wrapper }), invalidateSpy };
}

beforeEach(() => {
  mockDemand.mockReset();
  setVisibility('visible');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usePlatformSyncDemand', () => {
  it('keeps a hidden dashboard idle until it becomes visible', async () => {
    vi.useFakeTimers();
    setVisibility('hidden');
    mockDemand.mockResolvedValue(makeStatus());

    renderWithClient();
    await act(async () => vi.advanceTimersByTimeAsync(4000));

    expect(mockDemand).not.toHaveBeenCalled();

    setVisibility('visible');
    await act(async () => window.dispatchEvent(new Event('focus')));

    expect(mockDemand).toHaveBeenCalledTimes(1);
  });

  it('ignores hidden focus and resumes demand on the next visible cadence', async () => {
    vi.useFakeTimers();
    setVisibility('hidden');
    mockDemand.mockResolvedValue(makeStatus());

    renderWithClient();
    await act(async () => window.dispatchEvent(new Event('focus')));

    expect(mockDemand).not.toHaveBeenCalled();

    setVisibility('visible');
    await act(async () => vi.advanceTimersByTimeAsync(4000));

    expect(mockDemand).toHaveBeenCalledTimes(1);
  });

  it('demands on mount, focus, and each visible 4s cadence tick — but not while hidden', async () => {
    vi.useFakeTimers();
    mockDemand.mockResolvedValue(makeStatus());
    renderWithClient();
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(mockDemand).toHaveBeenCalledTimes(1); // mount

    await act(async () => window.dispatchEvent(new Event('focus')));
    expect(mockDemand).toHaveBeenCalledTimes(2); // focus (a reload/remount covers refresh)

    await act(async () => vi.advanceTimersByTimeAsync(4000));
    expect(mockDemand).toHaveBeenCalledTimes(3); // visible cadence

    setVisibility('hidden');
    await act(async () => vi.advanceTimersByTimeAsync(4000));
    expect(mockDemand).toHaveBeenCalledTimes(3); // hidden — no new demand
  });

  it('invalidates the target projection at the t0+9s maxima (≤10s SLO) without needing `current`, excluding an unfinished batch', async () => {
    vi.useFakeTimers();
    let resolveSecond!: (value: PlatformSyncStatus) => void;
    mockDemand
      .mockResolvedValueOnce(makeStatus({ state: 'updating', inFlight: true, lastBatchCount: null })) // t0
      .mockImplementationOnce(() => new Promise<PlatformSyncStatus>((resolve) => { resolveSecond = resolve; }));
    const { invalidateSpy } = renderWithClient();

    await act(async () => vi.advanceTimersByTimeAsync(0)); // t0: unfinished snapshot
    expect(invalidateSpy).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTimeAsync(4000)); // t0+4s: next cadence demands
    expect(mockDemand).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(4000)); // t0+8s: backend settles at its budget
    resolveSecond(makeStatus({ state: 'updating', lastBatchCount: 2, lastObservedCursor: 20 }));
    await act(async () => vi.advanceTimersByTimeAsync(1000)); // t0+9s: client invalidate+render budget

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['metrics'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tenants'] });
  });

  it('stops demand after a 404, leaving legacy polling as the sole refresh path', async () => {
    vi.useFakeTimers();
    mockDemand.mockRejectedValue({ status: 404, message: 'Not Found' });
    renderWithClient();
    await act(async () => vi.advanceTimersByTimeAsync(0));
    await act(async () => vi.advanceTimersByTimeAsync(8000));
    expect(mockDemand).toHaveBeenCalledTimes(1);
  });
});
