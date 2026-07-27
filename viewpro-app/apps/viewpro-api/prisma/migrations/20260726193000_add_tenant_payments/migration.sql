-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH', 'MERCADOPAGO_LINK', 'OTHER');
-- CreateTable
CREATE TABLE "tenant_payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "amountMinorUnits" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "method" "PaymentMethod" NOT NULL,
    "plan" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "receiptReference" TEXT,
    "note" TEXT,
    "recordedByOperatorId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversalOfPaymentId" TEXT,
    "reversalReason" TEXT,
    CONSTRAINT "tenant_payments_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "tenant_payments_reversalOfPaymentId_key" ON "tenant_payments"("reversalOfPaymentId");
-- CreateIndex
CREATE INDEX "tenant_payments_tenantId_periodEnd_idx" ON "tenant_payments"("tenantId", "periodEnd");
-- CreateIndex
CREATE INDEX "tenant_payments_recordedAt_idx" ON "tenant_payments"("recordedAt");
-- AddForeignKey
ALTER TABLE "tenant_payments" ADD CONSTRAINT "tenant_payments_reversalOfPaymentId_fkey" FOREIGN KEY ("reversalOfPaymentId") REFERENCES "tenant_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
