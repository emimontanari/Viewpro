CREATE TYPE "PublisherClaimChallengeMethod" AS ENUM ('EMAIL', 'LISTING');

CREATE TABLE "publisher_claim_challenges" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "publisherClaimId" TEXT NOT NULL,
    "method" "PublisherClaimChallengeMethod" NOT NULL,
    "codeDigest" TEXT NOT NULL,
    "recipientFingerprint" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "publisher_claim_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "publisher_claim_challenges_tenantId_recipientFingerprint_issuedAt_idx"
    ON "publisher_claim_challenges"("tenantId", "recipientFingerprint", "issuedAt");
CREATE INDEX "publisher_claim_challenges_publisherClaimId_method_issuedAt_idx"
    ON "publisher_claim_challenges"("publisherClaimId", "method", "issuedAt");

ALTER TABLE "publisher_claim_challenges"
    ADD CONSTRAINT "publisher_claim_challenges_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "publisher_claim_challenges"
    ADD CONSTRAINT "publisher_claim_challenges_publisherClaimId_fkey"
    FOREIGN KEY ("publisherClaimId") REFERENCES "publisher_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;
