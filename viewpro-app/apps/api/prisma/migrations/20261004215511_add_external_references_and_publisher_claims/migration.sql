-- CreateEnum
CREATE TYPE "ExternalPropertySource" AS ENUM ('ZONAPROP');

-- CreateEnum
CREATE TYPE "PublisherClaimState" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "PublisherClaimVerificationMethod" AS ENUM ('MANAGER_DOMAIN', 'EMAIL_CODE', 'LISTING_CODE');

-- CreateTable
CREATE TABLE "external_property_references" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalSource" "ExternalPropertySource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "propertyEngagementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_property_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publisher_claims" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalSource" "ExternalPropertySource" NOT NULL,
    "publisherId" TEXT NOT NULL,
    "state" "PublisherClaimState" NOT NULL DEFAULT 'PENDING',
    "verificationMethod" "PublisherClaimVerificationMethod",
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publisher_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publisher_claim_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "publisherClaimId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorUserId" TEXT,
    "verificationMethod" "PublisherClaimVerificationMethod",
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publisher_claim_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_property_references_propertyEngagementId_idx" ON "external_property_references"("propertyEngagementId");

-- CreateIndex
CREATE UNIQUE INDEX "external_property_references_tenantId_externalSource_extern_key" ON "external_property_references"("tenantId", "externalSource", "externalId");

-- Pending/rejected/revoked claims are non-exclusive; only one approved claim per publisher.
CREATE UNIQUE INDEX "publisher_claims_one_approved_per_publisher"
  ON "publisher_claims"("externalSource", "publisherId")
  WHERE "state" = 'APPROVED';

-- CreateIndex
CREATE INDEX "publisher_claims_externalSource_publisherId_state_idx" ON "publisher_claims"("externalSource", "publisherId", "state");

-- CreateIndex
CREATE INDEX "publisher_claims_tenantId_state_idx" ON "publisher_claims"("tenantId", "state");

-- CreateIndex
CREATE INDEX "publisher_claim_events_tenantId_publisherClaimId_createdAt_idx" ON "publisher_claim_events"("tenantId", "publisherClaimId", "createdAt");

-- AddForeignKey
ALTER TABLE "external_property_references" ADD CONSTRAINT "external_property_references_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_property_references" ADD CONSTRAINT "external_property_references_propertyEngagementId_fkey" FOREIGN KEY ("propertyEngagementId") REFERENCES "property_engagements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publisher_claims" ADD CONSTRAINT "publisher_claims_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publisher_claim_events" ADD CONSTRAINT "publisher_claim_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publisher_claim_events" ADD CONSTRAINT "publisher_claim_events_publisherClaimId_fkey" FOREIGN KEY ("publisherClaimId") REFERENCES "publisher_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publisher_claim_events" ADD CONSTRAINT "publisher_claim_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
