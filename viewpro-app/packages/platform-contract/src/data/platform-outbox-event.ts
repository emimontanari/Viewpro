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

// Q1/Q5 (platform-audit-log): discriminates who performed a mutation.
// `label` travels in-payload — no consumer-side cross-DB identity lookup (design A3).
export type AuditActor = {
  id: string
  type: 'operator' | 'user'
  label: string
}

// A1/A2 (platform-audit-log): one generic audit event carrying who/what/when/old→new.
// `tenantId`/`occurredAt` stay on the envelope — NOT duplicated inside the payload.
export type AuditLoggedPayload = {
  action: string
  previousValue: unknown
  newValue: unknown
  actor: AuditActor
}

export type PlatformOutboxEvent = {
  id: string
  seqNo: number
  eventType: 'TENANT_STATUS_CHANGED' | 'TENANT_REGISTERED' | 'AUDIT_LOGGED'
  tenantId: string
  payload: TenantStatusChangedPayload | TenantRegisteredPayload | AuditLoggedPayload
  occurredAt: string
}
