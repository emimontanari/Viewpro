export type AdminTenantStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
export type AdminTenantStatusAction = 'ACTIVE' | 'SUSPENDED';

export type AdminTenantLimits = {
  maxUsers: number | null;
  maxActivePropertyEngagements: number | null;
  maxDocumentsStorageMb: number | null;
};

export type AdminSummary = {
  totals: {
    tenants: number;
    activeTenants: number;
    users: number;
    activeEngagements: number;
    documentRequests: number;
    analyticsEvents: number;
  };
  recentActivityCount: number;
  generatedAt: string;
};

export type AdminTenant = {
  id: string;
  name: string;
  slug: string;
  status: AdminTenantStatus;
  limits: AdminTenantLimits;
  createdAt: string;
  updatedAt: string;
  counts: {
    memberships: number;
    propertyAssets: number;
    propertyEngagements: number;
    documentRequests: number;
    analyticsEvents: number;
  };
  lastActivityAt: string | null;
};

export type AdminTenantsResponse = {
  total: number;
  page: number;
  pageSize: number;
  items: AdminTenant[];
};

export type AdminActivity = {
  id: string;
  tenantId: string | null;
  eventName: string;
  actorType: string;
  propertyEngagementId: string | null;
  propertyAssetId: string | null;
  documentRequestId: string | null;
  movementId: string | null;
  occurredAt: string;
};

export type AdminActivityListResponse = {
  total: number;
  page: number;
  pageSize: number;
  items: AdminActivity[];
};

export type ListAdminTenantsInput = {
  page: number;
  pageSize: number;
  status?: AdminTenantStatus | '';
};

export type ListAdminActivityInput = {
  page: number;
  pageSize: number;
  tenantId?: string;
};

export type AdminTenantLimitsUpdateResponse = {
  tenantId: string;
  previousLimits: AdminTenantLimits;
  limits: AdminTenantLimits;
  unchanged: boolean;
  updatedAt: string;
};

export type UpdateAdminTenantLimitsPayload = AdminTenantLimits;

export type AdminTenantStatusUpdateResponse = {
  tenantId: string;
  previousStatus: AdminTenantStatus;
  status: AdminTenantStatus;
  unchanged: boolean;
  updatedAt: string;
};

export type UpdateAdminTenantStatusPayload = {
  status: AdminTenantStatusAction;
};

export type AdminDashboardData = {
  summary: AdminSummary;
  tenants: AdminTenantsResponse;
  activity: AdminActivityListResponse;
};
