// C.1 — RED: PlatformSyncStatusBadge tests (AC4-AC6): renders
// updating/stale/failed truthfully, stays silent while current/unknown.
import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { PlatformSyncStatusBadge } from '../platform-sync-status-badge';
import type { PlatformSyncStatus } from '../../api/types';

function makeStatus(overrides: Partial<PlatformSyncStatus> = {}): PlatformSyncStatus {
  return {
    state: 'stale', inFlight: false, attemptCount: 0, consecutiveFailureCount: 0,
    lastAttemptAt: null, lastSuccessAt: null, lastFailureAt: null,
    lastObservedCursor: null, lastBatchCount: null, failureCode: null, ...overrides
  };
}

describe('PlatformSyncStatusBadge', () => {
  it('renders nothing before the first response and while current', () => {
    render(<PlatformSyncStatusBadge status={null} />);
    expect(screen.queryByTestId('platform-sync-status-badge')).toBeNull();

    render(<PlatformSyncStatusBadge status={makeStatus({ state: 'current' })} />);
    expect(screen.queryAllByTestId('platform-sync-status-badge')).toHaveLength(0);
  });

  it.each([
    ['updating', 'Sincronizando datos…'],
    ['stale', 'Datos desactualizados'],
    ['failed', 'No se pudo sincronizar']
  ] as const)('renders the %s degraded state truthfully', (state, label) => {
    render(<PlatformSyncStatusBadge status={makeStatus({ state })} />);
    const badge = screen.getByTestId('platform-sync-status-badge');
    expect(badge.textContent).toBe(label);
    expect(badge.getAttribute('data-state')).toBe(state);
  });
});
