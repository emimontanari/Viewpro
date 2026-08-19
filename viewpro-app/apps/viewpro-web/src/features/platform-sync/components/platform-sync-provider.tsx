'use client';

import type { ReactNode } from 'react';
import { usePlatformSyncDemand } from './use-platform-sync-demand';
import { PlatformSyncStatusBadge } from './platform-sync-status-badge';

// Wired in app/dashboard/layout.tsx (Slice C, #327): mounts the demand
// cadence and renders the degraded-state badge. Pure composition of
// usePlatformSyncDemand + PlatformSyncStatusBadge, covered by their tests.
export function PlatformSyncProvider({ children }: { children: ReactNode }) {
  const { status } = usePlatformSyncDemand();

  return (
    <>
      {children}
      <PlatformSyncStatusBadge status={status} />
    </>
  );
}
