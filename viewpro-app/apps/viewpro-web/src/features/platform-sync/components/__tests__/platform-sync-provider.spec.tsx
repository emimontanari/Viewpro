import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../use-platform-sync-demand', () => ({
  usePlatformSyncDemand: vi.fn()
}));

import { usePlatformSyncDemand } from '../use-platform-sync-demand';
import { PlatformSyncProvider } from '../platform-sync-provider';
import type { PlatformSyncStatus } from '../../api/types';

const mockUsePlatformSyncDemand = vi.mocked(usePlatformSyncDemand);

function makeStatus(overrides: Partial<PlatformSyncStatus> = {}): PlatformSyncStatus {
  return {
    state: 'stale',
    inFlight: false,
    attemptCount: 0,
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

describe('PlatformSyncProvider', () => {
  beforeEach(() => {
    mockUsePlatformSyncDemand.mockReset();
  });

  it('keeps dashboard content visible while exposing a degraded synchronization state', () => {
    mockUsePlatformSyncDemand.mockReturnValue({
      status: makeStatus({ state: 'stale' }),
      isUnavailable: false
    });

    render(
      <PlatformSyncProvider>
        <h1>Platform tenants</h1>
      </PlatformSyncProvider>
    );

    expect(screen.getByRole('heading', { name: 'Platform tenants' })).toBeTruthy();
    expect(screen.getByRole('status')).toHaveTextContent('Datos desactualizados');
  });

  it('keeps dashboard content visible without a status announcement before the first response', () => {
    mockUsePlatformSyncDemand.mockReturnValue({ status: null, isUnavailable: false });

    render(
      <PlatformSyncProvider>
        <h1>Platform tenants</h1>
      </PlatformSyncProvider>
    );

    expect(screen.getByRole('heading', { name: 'Platform tenants' })).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
