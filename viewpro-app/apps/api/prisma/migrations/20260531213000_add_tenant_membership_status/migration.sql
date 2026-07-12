CREATE TYPE "TenantMembershipStatus" AS ENUM ('ACTIVE', 'DEACTIVATED');

ALTER TABLE "tenant_memberships"
  ADD COLUMN "status" "TenantMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "deactivatedAt" TIMESTAMP(3),
  ADD COLUMN "deactivatedByUserId" TEXT;

CREATE INDEX "tenant_memberships_tenantId_status_idx"
  ON "tenant_memberships"("tenantId", "status");
