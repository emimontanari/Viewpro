-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('ERROR', 'SUGGESTION');

-- CreateTable
CREATE TABLE "feedback_reports" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "FeedbackType" NOT NULL,
    "description" TEXT NOT NULL,
    "pathname" VARCHAR(512),
    "requestId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "feedback_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "feedback_submission_attempts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "feedback_submission_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_reports_tenantId_createdAt_idx" ON "feedback_reports"("tenantId", "createdAt");
CREATE INDEX "feedback_reports_tenantId_userId_createdAt_idx" ON "feedback_reports"("tenantId", "userId", "createdAt");
CREATE INDEX "feedback_submission_attempts_tenantId_userId_attemptedAt_idx" ON "feedback_submission_attempts"("tenantId", "userId", "attemptedAt");

-- AddForeignKey
ALTER TABLE "feedback_reports" ADD CONSTRAINT "feedback_reports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedback_reports" ADD CONSTRAINT "feedback_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedback_submission_attempts" ADD CONSTRAINT "feedback_submission_attempts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedback_submission_attempts" ADD CONSTRAINT "feedback_submission_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
