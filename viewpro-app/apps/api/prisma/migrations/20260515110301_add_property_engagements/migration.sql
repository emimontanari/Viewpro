-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('HOUSE', 'APARTMENT', 'LAND', 'COMMERCIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "PropertyOperationType" AS ENUM ('SALE', 'RENT');

-- CreateEnum
CREATE TYPE "PropertyEngagementStatus" AS ENUM ('CAPTURE', 'DOCUMENTATION_PENDING', 'PUBLICATION_PREPARATION', 'ACTIVE_PUBLICATION', 'INQUIRIES_AND_VISITS', 'OFFER_NEGOTIATION', 'RESERVATION_STARTED', 'FINAL_DOCUMENTATION', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "property_assets" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "propertyType" "PropertyType" NOT NULL,
    "ownerName" TEXT,
    "ownerEmail" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_engagements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyAssetId" TEXT NOT NULL,
    "operationType" "PropertyOperationType" NOT NULL,
    "status" "PropertyEngagementStatus" NOT NULL DEFAULT 'CAPTURE',
    "publishedPriceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_engagements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_agents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyEngagementId" TEXT NOT NULL,
    "agentUserId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_agents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "property_assets_createdByUserId_idx" ON "property_assets"("createdByUserId");

-- CreateIndex
CREATE INDEX "property_assets_city_province_idx" ON "property_assets"("city", "province");

-- CreateIndex
CREATE INDEX "property_engagements_tenantId_status_createdAt_idx" ON "property_engagements"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "property_engagements_propertyAssetId_idx" ON "property_engagements"("propertyAssetId");

-- CreateIndex
CREATE INDEX "property_engagements_createdByUserId_idx" ON "property_engagements"("createdByUserId");

-- CreateIndex
CREATE INDEX "property_agents_tenantId_agentUserId_idx" ON "property_agents"("tenantId", "agentUserId");

-- CreateIndex
CREATE INDEX "property_agents_assignedByUserId_idx" ON "property_agents"("assignedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "property_agents_propertyEngagementId_agentUserId_key" ON "property_agents"("propertyEngagementId", "agentUserId");

-- AddForeignKey
ALTER TABLE "property_assets" ADD CONSTRAINT "property_assets_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_engagements" ADD CONSTRAINT "property_engagements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_engagements" ADD CONSTRAINT "property_engagements_propertyAssetId_fkey" FOREIGN KEY ("propertyAssetId") REFERENCES "property_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_engagements" ADD CONSTRAINT "property_engagements_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_agents" ADD CONSTRAINT "property_agents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_agents" ADD CONSTRAINT "property_agents_propertyEngagementId_fkey" FOREIGN KEY ("propertyEngagementId") REFERENCES "property_engagements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_agents" ADD CONSTRAINT "property_agents_agentUserId_fkey" FOREIGN KEY ("agentUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_agents" ADD CONSTRAINT "property_agents_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
