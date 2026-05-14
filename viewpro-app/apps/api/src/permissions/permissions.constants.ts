export const PERMISSIONS = {
  TENANT_VIEW: 'tenant.view',
  TENANT_MANAGE_SETTINGS: 'tenant.manage_settings',
  TEAM_VIEW: 'team.view',
  TEAM_MANAGE: 'team.manage',
  ENGAGEMENTS_VIEW_ALL: 'engagements.view_all',
  ENGAGEMENTS_VIEW_ASSIGNED: 'engagements.view_assigned',
  ENGAGEMENTS_CREATE: 'engagements.create',
  MOVEMENTS_CREATE: 'movements.create',
  DOCUMENTS_VIEW_ALL: 'documents.view_all',
  DOCUMENTS_REQUEST: 'documents.request',
  DOCUMENTS_REVIEW_OWN: 'documents.review_own',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
