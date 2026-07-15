-- DEPLOY ORDER (platform-phase7-tenant-registry, R3):
-- Step 1: ship platform-contract union + additive payload fields (WU-1, PR 1 merged to main).
-- Step 2: deploy viewpro-api — platform_tenants migration + event-routed ingest + GET /operators/tenants.
--         (Ingest is tolerant of TENANT_REGISTERED before InmoView emits it — list may be empty.)
-- Step 3: deploy InmoView — TENANT_REGISTERED emit + enriched TENANT_STATUS_CHANGED + GET /internal/platform/tenants.
-- Step 4: run backfill seed once: pnpm --filter @viewpro/platform-api exec ts-node src/scripts/backfill-platform-tenants.ts
--         (Safe to re-run; all writes are idempotent upserts.)

-- CreateTable
CREATE TABLE "platform_tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "latestStatus" TEXT NOT NULL,
    "maxUsers" INTEGER,
    "maxActivePropertyEngagements" INTEGER,
    "maxDocumentsStorageMb" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_tenants_pkey" PRIMARY KEY ("id")
);
