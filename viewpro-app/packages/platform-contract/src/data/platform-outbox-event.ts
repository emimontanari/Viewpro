import type { PlatformTenantStatus } from '../control/tenant-status.js'

export type TenantStatusChangedPayload = {
  previousStatus: PlatformTenantStatus
  newStatus: PlatformTenantStatus
  // Additive optional enrichment (A3) — absent in legacy rows; present from Phase 7 onward.
  name?: string
  slug?: string
}

export type PlatformTenantRegistryLimits = {
  maxUsers: number | null
  maxActivePropertyEngagements: number | null
  maxDocumentsStorageMb: number | null
}

export type TenantRegisteredPayload = {
  id: string
  name: string
  slug: string
  // REQUIRED: initial tenant status. Must be present so the event passes the
  // MirrorRepository W2 guard (which skips events with empty newStatus).
  newStatus: PlatformTenantStatus
  limits: PlatformTenantRegistryLimits
}

export type PlatformOutboxEvent = {
  id: string
  seqNo: number
  eventType: 'TENANT_STATUS_CHANGED' | 'TENANT_REGISTERED'
  tenantId: string
  payload: TenantStatusChangedPayload | TenantRegisteredPayload
  occurredAt: string
}
