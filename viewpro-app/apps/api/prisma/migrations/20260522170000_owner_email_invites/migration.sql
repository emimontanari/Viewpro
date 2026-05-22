-- Add nullable contact snapshot columns first so existing rows can be backfilled.
ALTER TABLE "property_asset_owners"
  ADD COLUMN "ownerEmail" TEXT,
  ADD COLUMN "ownerFirstName" TEXT,
  ADD COLUMN "ownerLastName" TEXT;

-- Backfill existing registered owner links from the linked user profile.
UPDATE "property_asset_owners" AS pao
SET
  "ownerEmail" = LOWER(u."email"),
  "ownerFirstName" = u."firstName",
  "ownerLastName" = COALESCE(u."lastName", '')
FROM "users" AS u
WHERE pao."userId" = u."id";

-- Owner assignment is now email-first; historical rows must have a snapshot.
ALTER TABLE "property_asset_owners"
  ALTER COLUMN "ownerEmail" SET NOT NULL,
  ALTER COLUMN "ownerFirstName" SET NOT NULL,
  ALTER COLUMN "ownerLastName" SET NOT NULL,
  ALTER COLUMN "userId" DROP NOT NULL;

-- Prevent assigning the same normalized owner email twice to the same property.
CREATE UNIQUE INDEX "property_asset_owners_propertyAssetId_ownerEmail_key"
  ON "property_asset_owners"("propertyAssetId", "ownerEmail");
