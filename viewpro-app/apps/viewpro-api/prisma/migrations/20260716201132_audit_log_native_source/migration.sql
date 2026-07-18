-- CreateEnum
CREATE TYPE "PlatformAuditSource" AS ENUM ('INMOVIEW_OUTBOX', 'VIEWPRO_NATIVE');

-- AlterTable
ALTER TABLE "platform_audit_log" ADD COLUMN     "source" "PlatformAuditSource" NOT NULL DEFAULT 'INMOVIEW_OUTBOX',
ADD COLUMN     "target" JSONB,
ALTER COLUMN "sourceEventId" DROP NOT NULL,
ALTER COLUMN "seqNo" DROP NOT NULL,
ALTER COLUMN "tenantId" DROP NOT NULL;
