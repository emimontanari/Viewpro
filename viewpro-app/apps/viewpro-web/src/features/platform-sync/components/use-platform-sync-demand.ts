'use client';

// Demand-triggered platform sync (Slice C, #327): demands only while visible
// on mount, focus, and a 4s cadence; hidden makes no demand, no unload listener. A
// durable batch invalidates metrics/tenants even while `updating` (never
// requires `current`); an unfinished snapshot is excluded. A 404 disables
// further demand — legacy 5s polling stays the fallback refresh path.
import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isApiError } from '@/lib/api-client';
import { metricsKeys } from '@/features/metrics/api/queries';
import { tenantsKeys } from '@/features/tenants/api/queries';
import { demandPlatformSync } from '../api/service';
import type { PlatformSyncStatus } from '../api/types';

const VISIBLE_CADENCE_MS = 4000;

export function usePlatformSyncDemand() {
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<PlatformSyncStatus | null>(null);
  const [isUnavailable, setIsUnavailable] = React.useState(false);
  const invalidatedCursorRef = React.useRef<number | null>(null);
  const unavailableRef = React.useRef(false);

  const demand = React.useCallback(async () => {
    if (unavailableRef.current) return;

    try {
      const result = await demandPlatformSync();
      setStatus(result);

      const isDurableUnseenBatch =
        result.lastBatchCount !== null &&
        result.lastBatchCount > 0 &&
        result.failureCode === null &&
        result.lastObservedCursor !== invalidatedCursorRef.current;

      if (isDurableUnseenBatch) {
        invalidatedCursorRef.current = result.lastObservedCursor;
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: metricsKeys.all }),
          queryClient.invalidateQueries({ queryKey: tenantsKeys.all })
        ]);
      }
    } catch (error) {
      if (isApiError(error) && error.status === 404) {
        unavailableRef.current = true;
        setIsUnavailable(true);
      }
    }
  }, [queryClient]);

  React.useEffect(() => {
    const demandIfVisible = () => {
      if (document.visibilityState === 'visible') void demand();
    };

    demandIfVisible();
    const onFocus = demandIfVisible;
    window.addEventListener('focus', onFocus);
    const interval = window.setInterval(() => {
      demandIfVisible();
    }, VISIBLE_CADENCE_MS);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(interval);
    };
  }, [demand]);

  return { status, isUnavailable };
}
