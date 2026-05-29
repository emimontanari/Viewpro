CREATE TYPE "OwnerInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

CREATE TABLE "owner_invitations" (
  "id" TEXT NOT NULL,
  "propertyAssetOwnerId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "status" "OwnerInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "owner_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "owner_invitations_tokenHash_key"
  ON "owner_invitations"("tokenHash");

CREATE INDEX "owner_invitations_propertyAssetOwnerId_status_idx"
  ON "owner_invitations"("propertyAssetOwnerId", "status");

CREATE INDEX "owner_invitations_email_status_idx"
  ON "owner_invitations"("email", "status");

CREATE INDEX "owner_invitations_expiresAt_idx"
  ON "owner_invitations"("expiresAt");

ALTER TABLE "owner_invitations"
  ADD CONSTRAINT "owner_invitations_propertyAssetOwnerId_fkey"
  FOREIGN KEY ("propertyAssetOwnerId") REFERENCES "property_asset_owners"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
