-- CreateEnum
CREATE TYPE "StatusChangeRequestStatus" AS ENUM ('PENDING', 'RESOLVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'STATUS_CHANGE_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'STATUS_CHANGE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'STATUS_CHANGE_REJECTED';

-- CreateTable
CREATE TABLE "status_change_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyEngagementId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "targetStatus" "PropertyEngagementStatus" NOT NULL,
    "currentStatusSnapshot" "PropertyEngagementStatus" NOT NULL,
    "requestNote" TEXT,
    "status" "StatusChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "status_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "status_change_requests_tenantId_status_createdAt_idx" ON "status_change_requests"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "status_change_requests_propertyEngagementId_status_idx" ON "status_change_requests"("propertyEngagementId", "status");

-- CreateIndex
CREATE INDEX "status_change_requests_requestedByUserId_idx" ON "status_change_requests"("requestedByUserId");

-- CreateIndex
CREATE INDEX "status_change_requests_resolvedByUserId_idx" ON "status_change_requests"("resolvedByUserId");

-- AddForeignKey
ALTER TABLE "status_change_requests" ADD CONSTRAINT "status_change_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_change_requests" ADD CONSTRAINT "status_change_requests_propertyEngagementId_fkey" FOREIGN KEY ("propertyEngagementId") REFERENCES "property_engagements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_change_requests" ADD CONSTRAINT "status_change_requests_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_change_requests" ADD CONSTRAINT "status_change_requests_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PARTIAL UNIQUE INDEX — manually managed, do NOT drop
-- Purpose: enforce the FR-21 invariant "at most one PENDING StatusChangeRequest
-- per PropertyEngagement". Prisma cannot express partial unique indexes natively
-- via @@unique; any future `prisma migrate dev` run will NOT touch this index.
-- Constraint name is load-bearing: the create use case catches P2002 and checks
-- against STATUS_CHANGE_REQUEST_PENDING_UNIQUE_CONSTRAINT = 'status_change_requests_pending_engagement_key'
-- (see apps/api/src/status-change-requests/constants/db.ts).
-- If you ever need to rebuild this index, use:
--   DROP INDEX IF EXISTS "status_change_requests_pending_engagement_key";
--   CREATE UNIQUE INDEX "status_change_requests_pending_engagement_key"
--     ON "status_change_requests" ("propertyEngagementId")
--     WHERE status = 'PENDING';
CREATE UNIQUE INDEX "status_change_requests_pending_engagement_key"
  ON "status_change_requests" ("propertyEngagementId")
  WHERE status = 'PENDING';
