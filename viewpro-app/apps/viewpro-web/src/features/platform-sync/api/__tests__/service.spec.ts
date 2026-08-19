// C.1 — RED: demandPlatformSync() service tests (AC2, AC9).
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }));

import { apiRequest } from '@/lib/api-client';
import { demandPlatformSync } from '../service';
import type { PlatformSyncStatus } from '../types';

const mockApiRequest = vi.mocked(apiRequest);

const MOCK_STATUS: PlatformSyncStatus = {
  state: 'updating', inFlight: true, attemptCount: 1, consecutiveFailureCount: 0,
  lastAttemptAt: '2026-08-19T10:00:00.000Z', lastSuccessAt: null, lastFailureAt: null,
  lastObservedCursor: 8, lastBatchCount: 2, failureCode: null
};

beforeEach(() => {
  mockApiRequest.mockReset();
});

describe('demandPlatformSync()', () => {
  it('POSTs /operators/platform-sync/demand and returns the status untouched', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_STATUS);
    const result = await demandPlatformSync();
    expect(mockApiRequest).toHaveBeenCalledWith('/operators/platform-sync/demand', { method: 'POST' });
    expect(result).toEqual(MOCK_STATUS);
  });

  it('forwards API errors (401/404/500) without swallowing them', async () => {
    mockApiRequest.mockRejectedValueOnce({ status: 404, message: 'Not Found' });
    await expect(demandPlatformSync()).rejects.toMatchObject({ status: 404 });
  });
});
