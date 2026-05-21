-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MovementType" ADD VALUE 'ARCHIVED';
ALTER TYPE "MovementType" ADD VALUE 'RESTORED';

-- AlterTable
ALTER TABLE "property_engagements" ADD COLUMN     "archiveReason" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "property_engagements_tenantId_archivedAt_createdAt_idx" ON "property_engagements"("tenantId", "archivedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "property_engagements" ADD CONSTRAINT "property_engagements_archivedByUserId_fkey" FOREIGN KEY ("archivedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
