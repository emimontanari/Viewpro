-- CreateEnum
CREATE TYPE "PropertyAssetOwnerAccessStatus" AS ENUM ('INVITED', 'ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "property_asset_owners" (
    "id" TEXT NOT NULL,
    "propertyAssetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "accessStatus" "PropertyAssetOwnerAccessStatus" NOT NULL DEFAULT 'INVITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_asset_owners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "property_asset_owners_userId_accessStatus_idx" ON "property_asset_owners"("userId", "accessStatus");

-- CreateIndex
CREATE INDEX "property_asset_owners_propertyAssetId_idx" ON "property_asset_owners"("propertyAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "property_asset_owners_propertyAssetId_userId_key" ON "property_asset_owners"("propertyAssetId", "userId");

-- AddForeignKey
ALTER TABLE "property_asset_owners" ADD CONSTRAINT "property_asset_owners_propertyAssetId_fkey" FOREIGN KEY ("propertyAssetId") REFERENCES "property_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_asset_owners" ADD CONSTRAINT "property_asset_owners_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
