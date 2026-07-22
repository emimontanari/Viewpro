-- AlterEnum
ALTER TYPE "AnalyticsActorType" ADD VALUE 'PLATFORM_OPERATOR';

-- AlterTable
ALTER TABLE "analytics_events" ADD COLUMN     "actorOperatorId" TEXT;

-- CreateTable
CREATE TABLE "platform_command_log" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "commandType" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_command_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_command_log_idempotencyKey_key" ON "platform_command_log"("idempotencyKey");

-- CreateIndex
CREATE INDEX "analytics_events_actorOperatorId_occurredAt_idx" ON "analytics_events"("actorOperatorId", "occurredAt");
