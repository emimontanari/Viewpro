-- CreateTable
CREATE TABLE "platform_mirror_events" (
    "id" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "seqNo" INTEGER NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,

    CONSTRAINT "platform_mirror_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_ingest_cursor" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "seqNo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "platform_ingest_cursor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_mirror_events_sourceEventId_key" ON "platform_mirror_events"("sourceEventId");

-- CreateIndex
CREATE INDEX "platform_mirror_events_tenantId_seqNo_idx" ON "platform_mirror_events"("tenantId", "seqNo");

-- D7 bootstrap: seed the single cursor row with seqNo=0 so the poller always has a starting point.
INSERT INTO "platform_ingest_cursor" ("id", "seqNo") VALUES (1, 0) ON CONFLICT DO NOTHING;
