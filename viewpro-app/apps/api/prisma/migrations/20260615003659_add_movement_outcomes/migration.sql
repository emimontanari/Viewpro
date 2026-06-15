-- CreateEnum
CREATE TYPE "MovementBuiltInOutcome" AS ENUM ('EN_CAPTACION', 'DOCUMENTACION_PENDIENTE', 'PREPARANDO_PUBLICACION', 'PUBLICACION_ACTIVA', 'CONSULTAS_Y_VISITAS', 'NEGOCIACION_OFERTA', 'RESERVA_INICIADA', 'DOCUMENTACION_FINAL', 'CERRADO', 'CANCELADO');

-- DropForeignKey
ALTER TABLE "document_requests" DROP CONSTRAINT "document_requests_ownerUserId_fkey";

-- AlterTable
ALTER TABLE "movements" ADD COLUMN     "builtInOutcome" "MovementBuiltInOutcome",
ADD COLUMN     "customOutcomeLabelId" TEXT;

-- CreateTable
CREATE TABLE "tenant_movement_outcome_labels" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tenant_movement_outcome_labels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_movement_outcome_labels_tenantId_deletedAt_idx" ON "tenant_movement_outcome_labels"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "tenant_movement_outcome_labels_createdByUserId_idx" ON "tenant_movement_outcome_labels"("createdByUserId");

-- CreateIndex
CREATE INDEX "movements_customOutcomeLabelId_idx" ON "movements"("customOutcomeLabelId");

-- AddForeignKey
ALTER TABLE "tenant_movement_outcome_labels" ADD CONSTRAINT "tenant_movement_outcome_labels_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_movement_outcome_labels" ADD CONSTRAINT "tenant_movement_outcome_labels_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_customOutcomeLabelId_fkey" FOREIGN KEY ("customOutcomeLabelId") REFERENCES "tenant_movement_outcome_labels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PARTIAL UNIQUE INDEX — manually managed, do NOT drop
-- Purpose: enforce uniqueness of active (non-deleted) label names per tenant, while
-- allowing the same label name to be re-created after a soft-delete (deletedAt IS NOT NULL).
-- Prisma cannot express partial unique indexes natively via @@unique; any future
-- `prisma migrate dev` run will NOT touch this index because Prisma only manages
-- indexes it generated itself (via @@unique / @@index directives in the schema).
-- If you ever need to rebuild this index, use:
--   DROP INDEX IF EXISTS "tenant_movement_outcome_labels_active_tenant_label_key";
--   CREATE UNIQUE INDEX "tenant_movement_outcome_labels_active_tenant_label_key"
--     ON "tenant_movement_outcome_labels" ("tenantId", "label")
--     WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "tenant_movement_outcome_labels_active_tenant_label_key"
  ON "tenant_movement_outcome_labels" ("tenantId", "label")
  WHERE "deletedAt" IS NULL;
