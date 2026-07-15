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
