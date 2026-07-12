-- Document requests now target the property-owner link so invited owners can receive requests.
ALTER TABLE "document_requests"
  ADD COLUMN "propertyAssetOwnerId" TEXT;

-- Backfill existing user-targeted requests to their property owner link when possible.
UPDATE "document_requests" AS dr
SET "propertyAssetOwnerId" = pao."id"
FROM "property_engagements" AS pe
JOIN "property_asset_owners" AS pao
  ON pao."propertyAssetId" = pe."propertyAssetId"
WHERE dr."propertyEngagementId" = pe."id"
  AND dr."ownerUserId" IS NOT NULL
  AND pao."userId" = dr."ownerUserId";

-- Invited owners have no user yet, so this compatibility field must be nullable.
ALTER TABLE "document_requests"
  ALTER COLUMN "ownerUserId" DROP NOT NULL;

CREATE INDEX "document_requests_propertyAssetOwnerId_status_idx"
  ON "document_requests"("propertyAssetOwnerId", "status");

ALTER TABLE "document_requests"
  ADD CONSTRAINT "document_requests_propertyAssetOwnerId_fkey"
  FOREIGN KEY ("propertyAssetOwnerId") REFERENCES "property_asset_owners"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
