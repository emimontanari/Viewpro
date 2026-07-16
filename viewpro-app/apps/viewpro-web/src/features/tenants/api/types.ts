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

// PATCH body accepts these (server SetTenantStatusDto @IsIn, widened D6) —
// asymmetric with TenantStatus only for TRIAL, which is display-only and
// never a PATCH target.
export type TenantStatusAction = 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';

export type TenantLimits = {
  maxUsers: number | null;
  maxActivePropertyEngagements: number | null;
  maxDocumentsStorageMb: number | null;
};

// platform-manual-plans (Slice 4, Part 2) — fixed three-tier catalog (D10).
// The plan name lives ONLY in viewpro-api/viewpro-web (Design B isolation) —
// InmoView never sees it, only the resolved limit numbers.
export type TenantPlan = 'BASICO' | 'PROFESIONAL' | 'EMPRESA';

// GET /operators/tenants?offset&limit → TenantRegistryList
export type TenantListItem = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus; // = platform_tenants.latestStatus (server types it `string`; FE narrows)
  limits: TenantLimits;
  trialEndsAt: string | null; // ISO string, or null when absent (informational only)
  plan: TenantPlan | null; // = platform_tenants.plan (server types it `string | null`; FE narrows)
};

export type TenantListResponse = {
  total: number;
  items: TenantListItem[];
};

// PATCH bodies
export type UpdateTenantStatusPayload = { status: TenantStatusAction };
export type UpdateTenantLimitsPayload = TenantLimits;
export type UpdateTenantPlanPayload = { plan: TenantPlan };

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
