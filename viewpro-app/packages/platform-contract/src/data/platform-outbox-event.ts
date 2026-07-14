import type { PlatformTenantStatus } from '../control/tenant-status.js'

export type TenantStatusChangedPayload = {
  previousStatus: PlatformTenantStatus
  newStatus: PlatformTenantStatus
}

export type PlatformOutboxEvent = {
  id: string
  seqNo: number
  eventType: 'TENANT_STATUS_CHANGED'
  tenantId: string
  payload: TenantStatusChangedPayload
  occurredAt: string
}
