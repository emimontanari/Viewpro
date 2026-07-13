import type { IdempotencyKey } from "./identity.js";

// Own union — keep in sync with prisma TenantStatus (schema.prisma:20-25).
// Never import from "@prisma/client" (Design B no-Prisma seam).
export type PlatformTenantStatus = "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED";

// Writable-target policy (today ACTIVE|SUSPENDED) is a P5 runtime concern,
// intentionally not narrowed here. Ref: admin-tenant-status.repository.ts:7-11
export type SetTenantStatusCommand = {
  tenantId: string;
  targetStatus: PlatformTenantStatus;
  idempotencyKey: IdempotencyKey;
};

// Mirrors UpdateAdminTenantStatusResult (admin-tenant-status.repository.ts:14-29).
export type SetTenantStatusResult =
  | {
      status: "updated";
      tenantId: string;
      previousStatus: PlatformTenantStatus;
      currentStatus: PlatformTenantStatus;
      updatedAt: Date;
    }
  | {
      status: "unchanged";
      tenantId: string;
      previousStatus: PlatformTenantStatus;
      currentStatus: PlatformTenantStatus;
      updatedAt: Date;
    }
  | { status: "notFound" };
