-- CreateTable
CREATE TABLE "property_asset_images" (
    "id" TEXT NOT NULL,
    "propertyAssetId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_asset_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "property_asset_images_storageKey_key" ON "property_asset_images"("storageKey");

-- CreateIndex
CREATE INDEX "property_asset_images_propertyAssetId_idx" ON "property_asset_images"("propertyAssetId");

-- CreateIndex
CREATE INDEX "property_asset_images_uploadedByUserId_idx" ON "property_asset_images"("uploadedByUserId");

-- AddForeignKey
ALTER TABLE "property_asset_images" ADD CONSTRAINT "property_asset_images_propertyAssetId_fkey" FOREIGN KEY ("propertyAssetId") REFERENCES "property_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_asset_images" ADD CONSTRAINT "property_asset_images_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
