-- An owner invitation records which engagement it was created from, so the
-- agency that sent it is authoritative rather than derived.
--
-- It cannot be derived: property_engagements has no unique on propertyAssetId,
-- so one property may carry engagements under two tenants. Picking from that
-- list works today and names the wrong agency the first time it does not.

ALTER TABLE "owner_invitations"
  ADD COLUMN "propertyEngagementId" TEXT;

-- Backfill only where the AGENCY is unambiguous: the property has engagements
-- under exactly one tenant. Several engagements under that same tenant still
-- backfill — any of them names the same agency — so this counts distinct
-- tenants, not engagements.
--
-- Where a property carries engagements under two tenants the column stays NULL
-- and the invitation keeps the generic copy. Naming an agency we cannot prove
-- is worse than naming none: the reader cannot tell a guess from a fact.
--
-- For a backfilled row the engagement identifies the agency, not necessarily
-- the engagement the invitation was actually created from — that is
-- unknowable after the fact. Invitations created from here on carry the real
-- one, captured at creation.
UPDATE "owner_invitations" AS oi
SET "propertyEngagementId" = only_engagement."id"
FROM "property_asset_owners" AS pao
JOIN LATERAL (
  SELECT pe."id"
  FROM "property_engagements" AS pe
  WHERE pe."propertyAssetId" = pao."propertyAssetId"
  GROUP BY pe."id"
  HAVING (
    SELECT COUNT(DISTINCT inner_pe."tenantId")
    FROM "property_engagements" AS inner_pe
    WHERE inner_pe."propertyAssetId" = pao."propertyAssetId"
  ) = 1
  LIMIT 1
) AS only_engagement ON TRUE
WHERE oi."propertyAssetOwnerId" = pao."id";

ALTER TABLE "owner_invitations"
  ADD CONSTRAINT "owner_invitations_propertyEngagementId_fkey"
  FOREIGN KEY ("propertyEngagementId") REFERENCES "property_engagements"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "owner_invitations_propertyEngagementId_idx"
  ON "owner_invitations"("propertyEngagementId");
