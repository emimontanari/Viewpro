'use client';

import type { PlatformSyncStatus } from '../api/types';

const DEGRADED_LABELS: Record<Exclude<PlatformSyncStatus['state'], 'current'>, string> = {
  updating: 'Sincronizando datos…',
  stale: 'Datos desactualizados',
  failed: 'No se pudo sincronizar'
};

// Explicit degraded-state indicator (operator-console — Explicit Projection
// State): silent while current or before the first response (status===null).
export function PlatformSyncStatusBadge({ status }: { status: PlatformSyncStatus | null }) {
  if (!status || status.state === 'current') return null;

  return (
    <div
      role='status'
      data-testid='platform-sync-status-badge'
      data-state={status.state}
      className='bg-background text-muted-foreground fixed right-4 bottom-4 z-50 rounded-full border px-3 py-1.5 text-xs shadow-sm'
    >
      {DEGRADED_LABELS[status.state]}
    </div>
  );
}
