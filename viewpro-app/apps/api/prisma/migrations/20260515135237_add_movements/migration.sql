-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('GENERAL_UPDATE', 'INQUIRY', 'VISIT_SCHEDULED', 'VISIT_COMPLETED', 'OFFER_RECEIVED', 'DOCUMENTATION_UPDATE', 'STATUS_CHANGE');

-- CreateEnum
CREATE TYPE "MovementSource" AS ENUM ('MANUAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "InterestLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "movements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyEngagementId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "observation" TEXT NOT NULL,
    "nextStep" TEXT,
    "previousStatus" "PropertyEngagementStatus",
    "newStatus" "PropertyEngagementStatus",
    "source" "MovementSource" NOT NULL DEFAULT 'MANUAL',
    "interestCount" INTEGER,
    "visitCount" INTEGER,
    "offerAmountCents" INTEGER,
    "interestLevel" "InterestLevel",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "movements_tenantId_propertyEngagementId_createdAt_idx" ON "movements"("tenantId", "propertyEngagementId", "createdAt");

-- CreateIndex
CREATE INDEX "movements_createdByUserId_idx" ON "movements"("createdByUserId");

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_propertyEngagementId_fkey" FOREIGN KEY ("propertyEngagementId") REFERENCES "property_engagements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
