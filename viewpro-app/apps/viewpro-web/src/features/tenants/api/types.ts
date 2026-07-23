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

/**
 * FE-owned types for the tenant detail view (platform-tenant-tracking, D6/D9).
 *
 * Source: GET /operators/tenants/:id/summary → apps/viewpro-api's
 * TenantDetailController/TenantDetailService, a pure on-demand passthrough of
 * InmoView's GET /internal/platform/tenants/:id/summary
 * (apps/api/src/platform-data/platform-data.controller.ts —
 * `PlatformTenantSummaryResponse = PilotSummaryResponse & { activity }`).
 * Mirrored 1:1 here, matching the established FE-owned-type convention above —
 * no `packages/platform-contract` type for this wire shape.
 */
export type TenantDetailWindow = {
  from: string; // ISO string
  to: string; // ISO string
};

// Mirrors PilotSummaryResponse.documentEvents (apps/api's
// get-pilot-summary.use-case.ts) — 4 distinct AnalyticsEvent counts, NOT a
// single aggregate.
export type TenantDetailDocumentEvents = {
  requested: number;
  uploaded: number;
  approved: number;
  rejected: number;
};

// One merged-feed item (Movement | DocumentRequest | Membership), mirrors
// apps/api's ActivityFeedItemResponse union shape-wise but is intentionally
// kept loose (no full field-by-field type) — matches the SAME convention
// already used on the ViewPro backend for this exact endpoint
// (apps/viewpro-api/.../change-feed.client.ts `PlatformActivityFeedItem`).
// Only `kind`/`id`/`createdAt` are guaranteed; everything else is read
// defensively at render time (see tenant-detail activity-feed formatting).
//
// platform-user-activity-capture — 'membership' added (derived
// INVITED/JOINED/DEACTIVATED tenant-membership events). `membershipEvent`
// sub-discriminates within `kind: 'membership'`, mirroring how
// `type` sub-discriminates within `kind: 'movement'` server-side.
export type TenantActivityItem = {
  kind: 'movement' | 'document_request' | 'membership';
  id: string;
  createdAt: string; // ISO string
  membershipEvent?: 'INVITED' | 'JOINED' | 'DEACTIVATED' | 'ROLE_CHANGED';
  [key: string]: unknown;
};

export type TenantDetailActivity = {
  total: number;
  items: TenantActivityItem[];
};

// GET /operators/tenants/:id/summary?offset&limit
export type TenantDetailResponse = {
  window: TenantDetailWindow;
  activeEngagements: number;
  activeEngagementsWithOwnerVisibleUpdate: number;
  activeEngagementUpdatePercentage: number;
  documentEvents: TenantDetailDocumentEvents;
  ownerViewedPropertyCount: number;
  activity: TenantDetailActivity;
};

/**
 * operator-activity-media (Slice 2b, D4/D6): response shape for
 * GET /operators/tenants/:tenantId/document-versions/:versionId/read-url —
 * mirrors apps/viewpro-api's `PlatformDocumentReadUrlResponse` 1:1 (Design B
 * isolation — no shared package type). On-demand mint, 5-minute TTL; never
 * cached client-side (a re-click always re-fetches, per spec's "Expired URL
 * re-fetch" scenario).
 */
export type DocumentReadUrlResponse = {
  url: string;
  expiresInSeconds: number;
  originalFilename: string;
  mimeType: string;
};
