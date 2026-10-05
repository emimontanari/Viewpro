-- CreateEnum
CREATE TYPE "PropertyImportBatchState" AS ENUM ('PENDING', 'DISCOVERING', 'SCRAPING', 'READY', 'INCOMPLETE', 'FAILED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PropertyImportCandidateState" AS ENUM ('READY', 'EXISTING', 'INCOMPLETE', 'REJECTED', 'CONFIRMED', 'IMPORTED', 'FAILED');

-- CreateEnum
CREATE TYPE "PropertyImportWorkKind" AS ENUM ('DISCOVERY', 'SCRAPE', 'CONFIRMATION', 'IMAGE_COPY');

-- CreateEnum
CREATE TYPE "PropertyImportWorkState" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "property_import_batches" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "initiatedByUserId" TEXT NOT NULL,
    "externalSource" "ExternalPropertySource" NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "actorBuild" TEXT,
    "activeRunId" TEXT,
    "activeDatasetId" TEXT,
    "expectedCount" INTEGER,
    "discoveredCount" INTEGER,
    "uniqueReceivedCount" INTEGER,
    "truncationReason" TEXT,
    "state" "PropertyImportBatchState" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_import_candidates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceSnapshot" JSONB NOT NULL,
    "snapshotExpiresAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
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
    "publishedPriceCents" INTEGER,
    "currency" TEXT,
    "state" "PropertyImportCandidateState" NOT NULL DEFAULT 'INCOMPLETE',
    "rejectionReason" TEXT,
    "errorReason" TEXT,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "resultingReferenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_import_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_import_work" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "batchId" TEXT,
    "kind" "PropertyImportWorkKind" NOT NULL,
    "state" "PropertyImportWorkState" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseExpiresAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "correlationId" TEXT,
    "runId" TEXT,
    "datasetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_import_work_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "property_import_batches_tenantId_createdAt_idx" ON "property_import_batches"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "property_import_batches_tenantId_state_idx" ON "property_import_batches"("tenantId", "state");

-- CreateIndex
CREATE INDEX "property_import_candidates_tenantId_state_idx" ON "property_import_candidates"("tenantId", "state");

-- CreateIndex
CREATE INDEX "property_import_candidates_batchId_state_idx" ON "property_import_candidates"("batchId", "state");

-- CreateIndex
CREATE INDEX "property_import_candidates_snapshotExpiresAt_idx" ON "property_import_candidates"("snapshotExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "property_import_candidates_batchId_externalId_key" ON "property_import_candidates"("batchId", "externalId");

-- CreateIndex
CREATE INDEX "property_import_work_tenantId_state_leaseExpiresAt_idx" ON "property_import_work"("tenantId", "state", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "property_import_work_batchId_state_idx" ON "property_import_work"("batchId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "property_import_work_tenantId_idempotencyKey_key" ON "property_import_work"("tenantId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "property_import_batches" ADD CONSTRAINT "property_import_batches_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_import_batches" ADD CONSTRAINT "property_import_batches_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_import_candidates" ADD CONSTRAINT "property_import_candidates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_import_candidates" ADD CONSTRAINT "property_import_candidates_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "property_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_import_candidates" ADD CONSTRAINT "property_import_candidates_resultingReferenceId_fkey" FOREIGN KEY ("resultingReferenceId") REFERENCES "external_property_references"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_import_work" ADD CONSTRAINT "property_import_work_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_import_work" ADD CONSTRAINT "property_import_work_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "property_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
