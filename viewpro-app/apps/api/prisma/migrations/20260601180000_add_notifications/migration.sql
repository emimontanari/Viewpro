CREATE TYPE "NotificationSurface" AS ENUM ('INTERNAL', 'OWNER');
CREATE TYPE "NotificationType" AS ENUM ('DOCUMENT_REQUESTED', 'DOCUMENT_UPLOADED', 'DOCUMENT_APPROVED', 'DOCUMENT_REJECTED', 'PROPERTY_STATUS_CHANGED', 'MOVEMENT_CREATED');

CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "recipientUserId" TEXT NOT NULL,
    "surface" "NotificationSurface" NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "linkHref" TEXT,
    "propertyEngagementId" TEXT,
    "propertyAssetId" TEXT,
    "documentRequestId" TEXT,
    "movementId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_recipientUserId_surface_readAt_createdAt_idx" ON "notifications"("recipientUserId", "surface", "readAt", "createdAt");
CREATE INDEX "notifications_tenantId_recipientUserId_surface_createdAt_idx" ON "notifications"("tenantId", "recipientUserId", "surface", "createdAt");
CREATE INDEX "notifications_tenantId_surface_createdAt_idx" ON "notifications"("tenantId", "surface", "createdAt");
CREATE INDEX "notifications_propertyEngagementId_idx" ON "notifications"("propertyEngagementId");
CREATE INDEX "notifications_propertyAssetId_idx" ON "notifications"("propertyAssetId");
CREATE INDEX "notifications_documentRequestId_idx" ON "notifications"("documentRequestId");
CREATE INDEX "notifications_movementId_idx" ON "notifications"("movementId");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_propertyEngagementId_fkey" FOREIGN KEY ("propertyEngagementId") REFERENCES "property_engagements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_propertyAssetId_fkey" FOREIGN KEY ("propertyAssetId") REFERENCES "property_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_documentRequestId_fkey" FOREIGN KEY ("documentRequestId") REFERENCES "document_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
