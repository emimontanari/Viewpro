// Stage 10 admin read-only frontend contract is tracked in docs/plans/2026-05-13-viewpro-implementation-roadmap.md.
import { apiRequest } from './api-client'

export type AdminSummary = {
  totals: {
    tenants: number
    activeTenants: number
    users: number
    activeEngagements: number
    documentRequests: number
    analyticsEvents: number
  }
  recentActivityCount: number
  generatedAt: string
}

export type AdminTenant = {
  id: string
  name: string
  slug: string
  status: string
  createdAt: string
  updatedAt: string
  counts: {
    memberships: number
    propertyAssets: number
    propertyEngagements: number
    documentRequests: number
    analyticsEvents: number
  }
  lastActivityAt: string | null
}

export type AdminTenantsResponse = {
  total: number
  page: number
  pageSize: number
  items: AdminTenant[]
}

export type AdminActivity = {
  id: string
  tenantId: string | null
  eventName: string
  actorType: string
  propertyEngagementId: string | null
  propertyAssetId: string | null
  documentRequestId: string | null
  movementId: string | null
  occurredAt: string
}

export type AdminActivityListResponse = {
  total: number
  page: number
  pageSize: number
  items: AdminActivity[]
}

export type ListAdminTenantsInput = {
  page: number
  pageSize: number
  status?: string
}

export type ListAdminActivityInput = {
  page: number
  pageSize: number
  tenantId?: string
}

export type AdminDashboardData = {
  summary: AdminSummary
  tenants: AdminTenantsResponse
  activity: AdminActivityListResponse
}

export function getAdminSummary() {
  return apiRequest<AdminSummary>('/admin/summary')
}

export function listAdminTenants(input: ListAdminTenantsInput) {
  const searchParams = new URLSearchParams()
  searchParams.set('page', String(input.page))
  searchParams.set('pageSize', String(input.pageSize))

  if (input.status) {
    searchParams.set('status', input.status)
  }

  return apiRequest<AdminTenantsResponse>(`/admin/tenants?${searchParams.toString()}`)
}

export function listAdminActivity(input: ListAdminActivityInput) {
  const searchParams = new URLSearchParams()
  searchParams.set('page', String(input.page))
  searchParams.set('pageSize', String(input.pageSize))

  if (input.tenantId) {
    searchParams.set('tenantId', input.tenantId)
  }

  return apiRequest<AdminActivityListResponse>(`/admin/activity?${searchParams.toString()}`)
}

export function getAdminDashboardData(): Promise<AdminDashboardData> {
  return Promise.all([
    getAdminSummary(),
    listAdminTenants({ page: 1, pageSize: 10 }),
    listAdminActivity({ page: 1, pageSize: 10 }),
  ]).then(([summary, tenants, activity]) => ({ activity, summary, tenants }))
}
