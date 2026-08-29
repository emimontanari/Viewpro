// PlatformSyncStatus — matches viewpro-api PlatformSyncCoordinator status
// exactly (apps/viewpro-api/src/platform-data/platform-sync-coordinator.ts).
export type PlatformSyncFailureCode =
  | 'CURSOR_READ_FAILED'
  | 'FEED_TIMEOUT'
  | 'FEED_FAILED'
  | 'PROJECTION_FAILED'
  | 'CURSOR_ADVANCE_FAILED';

export type PlatformSyncStatus = {
  state: 'current' | 'updating' | 'stale' | 'failed';
  inFlight: boolean;
  attemptCount: number;
  consecutiveFailureCount: number;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastObservedCursor: number | null;
  lastBatchCount: number | null;
  failureCode: PlatformSyncFailureCode | null;
};
