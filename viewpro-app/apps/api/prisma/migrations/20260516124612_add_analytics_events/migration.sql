-- CreateEnum
CREATE TYPE "AnalyticsActorType" AS ENUM ('INTERNAL_USER', 'OWNER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AnalyticsEventName" AS ENUM ('SELLER_LOGGED_IN', 'MOVEMENT_CREATED', 'PROPERTY_STATUS_CHANGED', 'OWNER_VIEWED_PROPERTY', 'DOCUMENT_REQUESTED', 'DOCUMENT_UPLOADED', 'DOCUMENT_APPROVED', 'DOCUMENT_REJECTED');

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "actorUserId" TEXT,
    "actorType" "AnalyticsActorType" NOT NULL,
    "eventName" "AnalyticsEventName" NOT NULL,
    "propertyEngagementId" TEXT,
    "propertyAssetId" TEXT,
    "documentRequestId" TEXT,
    "movementId" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_events_tenantId_eventName_occurredAt_idx" ON "analytics_events"("tenantId", "eventName", "occurredAt");

-- CreateIndex
CREATE INDEX "analytics_events_tenantId_occurredAt_idx" ON "analytics_events"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "analytics_events_propertyEngagementId_occurredAt_idx" ON "analytics_events"("propertyEngagementId", "occurredAt");

-- CreateIndex
CREATE INDEX "analytics_events_actorUserId_occurredAt_idx" ON "analytics_events"("actorUserId", "occurredAt");
