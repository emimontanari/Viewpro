// Design B (D7): direct apiRequest to viewpro-api — no Next.js BFF route.
import { apiRequest } from '@/lib/api-client';
import type { PlatformSyncStatus } from './types';

// POST /operators/platform-sync/demand — starts/joins the shared coordinator
// run and races it up to 4s without cancelling admitted work (design.md).
export async function demandPlatformSync(): Promise<PlatformSyncStatus> {
  return apiRequest<PlatformSyncStatus>('/operators/platform-sync/demand', { method: 'POST' });
}
