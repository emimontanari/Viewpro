-- DEPLOY ORDER (platform-audit-log, R1):
-- Step 1: ship platform-contract union member AUDIT_LOGGED + AuditLoggedPayload (WU-1, PR 1 merged to main).
-- Step 2: deploy viewpro-api — platform_audit_log migration + explicit AUDIT_LOGGED ingest branch (tolerant)
--         + GET /operators/audit. No audit events exist yet — the feed is empty, which is acceptable.
-- Step 3: deploy InmoView — AUDIT_LOGGED emit at both the status and limits sites.
-- Step 4: features/audit (viewpro-web) is additive and ships last / independently.

-- CreateTable
CREATE TABLE "platform_audit_log" (
    "id" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "seqNo" BIGINT NOT NULL,
    "action" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actor" JSONB NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_audit_log_sourceEventId_key" ON "platform_audit_log"("sourceEventId");

-- CreateIndex
CREATE INDEX "platform_audit_log_seqNo_idx" ON "platform_audit_log"("seqNo");
