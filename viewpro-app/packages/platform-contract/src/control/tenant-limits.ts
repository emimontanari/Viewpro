import type { IdempotencyKey } from "./identity";

// Maps Tenant.maxUsers / maxActivePropertyEngagements / maxDocumentsStorageMb
// (schema.prisma:219-221, all Int?). Ref: admin-tenant-limits.repository.ts:5-9
export type PlatformTenantLimits = {
  maxUsers: number | null;
  maxActivePropertyEngagements: number | null;
  maxDocumentsStorageMb: number | null;
};

export type SetTenantLimitsCommand = {
  tenantId: string;
  limits: PlatformTenantLimits;
  idempotencyKey: IdempotencyKey;
};

// Mirrors UpdateAdminTenantLimitsResult (admin-tenant-limits.repository.ts:18-33).
export type SetTenantLimitsResult =
  | {
      status: "updated";
      tenantId: string;
      previousLimits: PlatformTenantLimits;
      limits: PlatformTenantLimits;
      updatedAt: Date;
    }
  | {
      status: "unchanged";
      tenantId: string;
      previousLimits: PlatformTenantLimits;
      limits: PlatformTenantLimits;
      updatedAt: Date;
    }
  | { status: "notFound" };
