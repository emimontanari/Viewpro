CREATE TYPE "TeamInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

CREATE TABLE "team_invitations" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "TenantRole" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "status" "TeamInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "invitedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "team_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "team_invitations_tokenHash_key"
  ON "team_invitations"("tokenHash");

CREATE INDEX "team_invitations_tenantId_status_idx"
  ON "team_invitations"("tenantId", "status");

CREATE INDEX "team_invitations_email_status_idx"
  ON "team_invitations"("email", "status");

CREATE INDEX "team_invitations_expiresAt_idx"
  ON "team_invitations"("expiresAt");

ALTER TABLE "team_invitations"
  ADD CONSTRAINT "team_invitations_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "team_invitations"
  ADD CONSTRAINT "team_invitations_invitedByUserId_fkey"
  FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
