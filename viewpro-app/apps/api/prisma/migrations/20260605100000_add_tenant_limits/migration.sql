ALTER TYPE "AnalyticsEventName" ADD VALUE 'TENANT_LIMITS_UPDATED';

ALTER TABLE "tenants"
  ADD COLUMN "maxUsers" INTEGER,
  ADD COLUMN "maxActivePropertyEngagements" INTEGER,
  ADD COLUMN "maxDocumentsStorageMb" INTEGER;
