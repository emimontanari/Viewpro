/**
 * FE-owned types for the operator tenant-management console.
 *
 * Source: GET /operators/tenants → apps/api/src/platform-data/tenant-registry.service.ts
 * PATCH responses are typed `unknown` server-side (opaque InmoView control-lane
 * passthrough) — apps/api/src/admin/responses/admin-tenant-{status,limits}.response.ts
 * traces the exact shapes below. Do NOT import the dead `SetTenantStatusResult`
 * / `SetTenantLimitsResult` types from the platform-contract package — those
 * types do not match the wire shape (D3).
 */

export type TenantStatus = 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';

// PATCH body accepts only these (server SetTenantStatusDto @IsIn) — asymmetric
// with TenantStatus, which also covers TRIAL/CANCELLED for display (D14).
export type TenantStatusAction = 'ACTIVE' | 'SUSPENDED';

export type TenantLimits = {
  maxUsers: number | null;
  maxActivePropertyEngagements: number | null;
  maxDocumentsStorageMb: number | null;
};

// GET /operators/tenants?offset&limit → TenantRegistryList
export type TenantListItem = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus; // = platform_tenants.latestStatus (server types it `string`; FE narrows)
  limits: TenantLimits;
};

export type TenantListResponse = {
  total: number;
  items: TenantListItem[];
};

// PATCH bodies
export type UpdateTenantStatusPayload = { status: TenantStatusAction };
export type UpdateTenantLimitsPayload = TenantLimits;

// PATCH responses — passthrough of InmoView control-lane bodies (server type: unknown).
export type AdminTenantStatusUpdateResponse = {
  tenantId: string;
  previousStatus: TenantStatus;
  status: TenantStatus;
  unchanged: boolean;
  updatedAt: string; // ISO string
};

export type AdminTenantLimitsUpdateResponse = {
  tenantId: string;
  previousLimits: TenantLimits;
  limits: TenantLimits;
  unchanged: boolean;
  updatedAt: string; // ISO string
};
