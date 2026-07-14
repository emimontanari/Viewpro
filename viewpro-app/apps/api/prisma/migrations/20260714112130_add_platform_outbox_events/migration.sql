-- R1: deploy this migration BEFORE updating app code to write/read platform_outbox_events

-- CreateTable
CREATE TABLE "platform_outbox_events" (
    "id" TEXT NOT NULL,
    "seqNo" BIGSERIAL NOT NULL,
    "eventType" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_outbox_events_seqNo_idx" ON "platform_outbox_events"("seqNo");

-- CreateIndex
CREATE INDEX "platform_outbox_events_occurredAt_seqNo_idx" ON "platform_outbox_events"("occurredAt", "seqNo");
