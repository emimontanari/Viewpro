import { PERMISSIONS } from '../../permissions/permissions.constants'
import type { TenantContext } from '../../tenant-context/tenant-context.types'

export function canViewAllDocumentRequests(tenant: TenantContext): boolean {
  return tenant.permissions.includes(PERMISSIONS.DOCUMENTS_VIEW_ALL)
}

export function canReviewOwnDocumentRequests(tenant: TenantContext): boolean {
  return tenant.permissions.includes(PERMISSIONS.DOCUMENTS_REVIEW_OWN)
}
