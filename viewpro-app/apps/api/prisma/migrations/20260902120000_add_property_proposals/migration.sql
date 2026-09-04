-- Additive schema without rewrites; explicit transaction bounds source-index locks and waits.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TYPE "PropertyProposalStatus" AS ENUM ('BORRADOR', 'EN_REVISION', 'APROBADA', 'RECHAZADA');
CREATE TYPE "PropertyProposalReviewOutcome" AS ENUM ('APPROVED', 'REJECTED');

CREATE TABLE "property_proposals" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "proposedByUserId" TEXT NOT NULL,
    "state" "PropertyProposalStatus" NOT NULL DEFAULT 'BORRADOR',
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "addressLine" TEXT,
    "city" TEXT,
    "province" TEXT,
    "propertyType" "PropertyType",
    "operationType" "PropertyOperationType",
    "totalAreaSqm" INTEGER,
    "coveredAreaSqm" INTEGER,
    "rooms" INTEGER,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "garages" INTEGER,
    "ageYears" INTEGER,
    "orientation" TEXT,
    "ownerName" TEXT,
    "ownerEmail" TEXT,
    "publishedPriceCents" INTEGER,
    "currency" TEXT,
    "latestSubmittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "property_proposals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "property_proposals_title_check" CHECK (
        "title" = BTRIM("title")
        AND CHAR_LENGTH("title") BETWEEN 1 AND 255
    ),
    CONSTRAINT "property_proposals_optional_text_check" CHECK (
        ("addressLine" IS NULL OR ("addressLine" = BTRIM("addressLine") AND CHAR_LENGTH("addressLine") BETWEEN 1 AND 255))
        AND ("city" IS NULL OR ("city" = BTRIM("city") AND CHAR_LENGTH("city") BETWEEN 1 AND 255))
        AND ("province" IS NULL OR ("province" = BTRIM("province") AND CHAR_LENGTH("province") BETWEEN 1 AND 255))
        AND ("orientation" IS NULL OR ("orientation" = BTRIM("orientation") AND CHAR_LENGTH("orientation") BETWEEN 1 AND 100))
        AND ("ownerName" IS NULL OR ("ownerName" = BTRIM("ownerName") AND CHAR_LENGTH("ownerName") BETWEEN 1 AND 255))
        AND ("ownerEmail" IS NULL OR ("ownerEmail" = BTRIM("ownerEmail") AND CHAR_LENGTH("ownerEmail") BETWEEN 1 AND 320))
        AND ("currency" IS NULL OR ("currency" = BTRIM("currency") AND CHAR_LENGTH("currency") BETWEEN 1 AND 3))
    ),
    CONSTRAINT "property_proposals_numeric_check" CHECK (
        "version" >= 1
        AND ("totalAreaSqm" IS NULL OR "totalAreaSqm" >= 0)
        AND ("coveredAreaSqm" IS NULL OR "coveredAreaSqm" >= 0)
        AND ("rooms" IS NULL OR "rooms" >= 0)
        AND ("bedrooms" IS NULL OR "bedrooms" >= 0)
        AND ("bathrooms" IS NULL OR "bathrooms" >= 0)
        AND ("garages" IS NULL OR "garages" >= 0)
        AND ("ageYears" IS NULL OR "ageYears" >= 0)
        AND ("publishedPriceCents" IS NULL OR "publishedPriceCents" >= 0)
    )
);

CREATE TABLE "property_proposal_review_rounds" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "addressLine" TEXT,
    "city" TEXT,
    "province" TEXT,
    "propertyType" "PropertyType",
    "operationType" "PropertyOperationType",
    "totalAreaSqm" INTEGER,
    "coveredAreaSqm" INTEGER,
    "rooms" INTEGER,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "garages" INTEGER,
    "ageYears" INTEGER,
    "orientation" TEXT,
    "ownerName" TEXT,
    "ownerEmail" TEXT,
    "publishedPriceCents" INTEGER,
    "currency" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "property_proposal_review_rounds_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "property_proposal_review_rounds_title_check" CHECK (
        "title" = BTRIM("title")
        AND CHAR_LENGTH("title") BETWEEN 1 AND 255
    ),
    CONSTRAINT "property_proposal_review_rounds_text_check" CHECK (
        ("addressLine" IS NULL OR ("addressLine" = BTRIM("addressLine") AND CHAR_LENGTH("addressLine") BETWEEN 1 AND 255))
        AND ("city" IS NULL OR ("city" = BTRIM("city") AND CHAR_LENGTH("city") BETWEEN 1 AND 255))
        AND ("province" IS NULL OR ("province" = BTRIM("province") AND CHAR_LENGTH("province") BETWEEN 1 AND 255))
        AND ("orientation" IS NULL OR ("orientation" = BTRIM("orientation") AND CHAR_LENGTH("orientation") BETWEEN 1 AND 100))
        AND ("ownerName" IS NULL OR ("ownerName" = BTRIM("ownerName") AND CHAR_LENGTH("ownerName") BETWEEN 1 AND 255))
        AND ("ownerEmail" IS NULL OR ("ownerEmail" = BTRIM("ownerEmail") AND CHAR_LENGTH("ownerEmail") BETWEEN 1 AND 320))
        AND ("currency" IS NULL OR ("currency" = BTRIM("currency") AND CHAR_LENGTH("currency") BETWEEN 1 AND 3))
    ),
    CONSTRAINT "property_proposal_review_rounds_numeric_check" CHECK (
        "roundNumber" >= 1
        AND ("totalAreaSqm" IS NULL OR "totalAreaSqm" >= 0)
        AND ("coveredAreaSqm" IS NULL OR "coveredAreaSqm" >= 0)
        AND ("rooms" IS NULL OR "rooms" >= 0)
        AND ("bedrooms" IS NULL OR "bedrooms" >= 0)
        AND ("bathrooms" IS NULL OR "bathrooms" >= 0)
        AND ("garages" IS NULL OR "garages" >= 0)
        AND ("ageYears" IS NULL OR "ageYears" >= 0)
        AND ("publishedPriceCents" IS NULL OR "publishedPriceCents" >= 0)
    )
);

CREATE TABLE "property_proposal_review_decisions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reviewRoundId" TEXT NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "outcome" "PropertyProposalReviewOutcome" NOT NULL,
    "rejectionReason" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "property_proposal_review_decisions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "property_proposal_review_decisions_outcome_check" CHECK (
        (
            "outcome" = 'APPROVED'
            AND "rejectionReason" IS NULL
        )
        OR (
            "outcome" = 'REJECTED'
            AND "rejectionReason" IS NOT NULL
            AND "rejectionReason" = BTRIM("rejectionReason")
            AND CHAR_LENGTH("rejectionReason") BETWEEN 1 AND 1000
        )
    )
);

ALTER TABLE "property_engagements" ADD COLUMN "sourceProposalId" TEXT;

CREATE UNIQUE INDEX "property_proposals_id_tenantId_key" ON "property_proposals"("id", "tenantId");
CREATE INDEX "property_proposals_seller_list_idx" ON "property_proposals"("tenantId", "proposedByUserId", "updatedAt" DESC, "id" DESC);
-- Prisma cannot model this COALESCE expression index; keep it as raw SQL.
CREATE INDEX "property_proposals_manager_inbox_idx" ON "property_proposals"("tenantId", "state", (COALESCE("latestSubmittedAt", "createdAt")) DESC, "id" DESC);
CREATE UNIQUE INDEX "property_proposal_review_rounds_id_tenantId_key" ON "property_proposal_review_rounds"("id", "tenantId");
CREATE UNIQUE INDEX "property_proposal_review_rounds_proposalId_roundNumber_key" ON "property_proposal_review_rounds"("proposalId", "roundNumber");
CREATE INDEX "property_proposal_review_rounds_tenantId_submittedAt_idx" ON "property_proposal_review_rounds"("tenantId", "submittedAt");
CREATE UNIQUE INDEX "property_proposal_review_decisions_reviewRoundId_key" ON "property_proposal_review_decisions"("reviewRoundId");
CREATE UNIQUE INDEX "property_proposal_review_decisions_reviewRoundId_tenantId_key" ON "property_proposal_review_decisions"("reviewRoundId", "tenantId");
CREATE INDEX "property_proposal_review_decisions_tenantId_decidedAt_idx" ON "property_proposal_review_decisions"("tenantId", "decidedAt");
CREATE INDEX "property_proposal_review_decisions_reviewerUserId_idx" ON "property_proposal_review_decisions"("reviewerUserId");
CREATE UNIQUE INDEX "property_engagements_sourceProposalId_key" ON "property_engagements"("sourceProposalId");
CREATE UNIQUE INDEX "property_engagements_sourceProposalId_tenantId_key" ON "property_engagements"("sourceProposalId", "tenantId");

ALTER TABLE "property_proposals" ADD CONSTRAINT "property_proposals_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "property_proposals" ADD CONSTRAINT "property_proposals_proposedByUserId_fkey"
    FOREIGN KEY ("proposedByUserId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "property_proposal_review_rounds" ADD CONSTRAINT "property_proposal_review_rounds_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "property_proposal_review_rounds" ADD CONSTRAINT "property_proposal_review_rounds_proposalId_tenantId_fkey"
    FOREIGN KEY ("proposalId", "tenantId") REFERENCES "property_proposals"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "property_proposal_review_rounds" ADD CONSTRAINT "property_proposal_review_rounds_submittedByUserId_fkey"
    FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "property_proposal_review_decisions" ADD CONSTRAINT "property_proposal_review_decisions_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "property_proposal_review_decisions" ADD CONSTRAINT "property_proposal_review_decisions_reviewRoundId_tenantId_fkey"
    FOREIGN KEY ("reviewRoundId", "tenantId") REFERENCES "property_proposal_review_rounds"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "property_proposal_review_decisions" ADD CONSTRAINT "property_proposal_review_decisions_reviewerUserId_fkey"
    FOREIGN KEY ("reviewerUserId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "property_engagements" ADD CONSTRAINT "property_engagements_sourceProposalId_tenantId_fkey"
    FOREIGN KEY ("sourceProposalId", "tenantId") REFERENCES "property_proposals"("id", "tenantId") ON DELETE NO ACTION ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "property_engagements" VALIDATE CONSTRAINT "property_engagements_sourceProposalId_tenantId_fkey";

COMMIT;
