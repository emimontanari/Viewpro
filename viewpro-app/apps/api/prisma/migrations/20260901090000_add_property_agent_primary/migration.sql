-- AlterTable
ALTER TABLE "property_agents"
  ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT FALSE;

-- Raw-SQL partial-index invariant: Prisma cannot express this partial unique index.
CREATE UNIQUE INDEX "property_agents_one_primary_per_engagement"
  ON "property_agents" ("propertyEngagementId")
  WHERE "isPrimary" = TRUE;
