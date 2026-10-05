import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import type { ClsService } from "nestjs-cls";
import { afterAll, describe, expect, it } from "vitest";
import { createTenantIsolationExtension, TENANT_OWNED_MODELS } from "../src/database/tenant-isolation.extension";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const schema = () => readFileSync(join(appRoot, "apps/api/prisma/schema.prisma"), "utf8");
const prisma = new PrismaClient();
afterAll(async () => prisma.$disconnect());

describe("publisher claim challenge persistence contract", () => {
  it("roundtrips challenge lifecycle fields and tenant-scopes real queries while documenting the claim transaction seam", async () => {
    const suffix = randomUUID();
    const tenantA = `challenge-a-${suffix}`;
    const tenantB = `challenge-b-${suffix}`;
    const missingTenant = `challenge-missing-tenant-${suffix}`;
    const claimA = `challenge-claim-a-${suffix}`;
    const missingClaim = `challenge-missing-claim-${suffix}`;
    const emailChallenge = `challenge-email-${suffix}`;
    const listingChallenge = `challenge-listing-${suffix}`;
    const mismatchChallenge = `challenge-mismatch-${suffix}`;
    const missingTenantChallenge = `challenge-missing-tenant-${suffix}`;
    const missingClaimChallenge = `challenge-missing-claim-${suffix}`;
    const claimIds = [claimA, `challenge-claim-b-${suffix}`];
    const tenantIds = [tenantA, tenantB];
    const challengeIds = [emailChallenge, listingChallenge, mismatchChallenge, missingTenantChallenge, missingClaimChallenge];
    try {
      await prisma.tenant.createMany({ data: [
        { id: tenantA, name: tenantA, slug: tenantA },
        { id: tenantB, name: tenantB, slug: tenantB },
      ] });
      const claimB = claimIds[1]!;
      await prisma.publisherClaim.createMany({ data: [
        { id: claimA, tenantId: tenantA, externalSource: "ZONAPROP", publisherId: `publisher-a-${suffix}` },
        { id: claimB, tenantId: tenantB, externalSource: "ZONAPROP", publisherId: `publisher-b-${suffix}` },
      ] });
      let activeTenantId: string | undefined = tenantA;
      const fakeCls = {
        isActive: () => activeTenantId !== undefined,
        get: () => activeTenantId,
      } as unknown as ClsService;
      const tenantPrisma = prisma.$extends(createTenantIsolationExtension(fakeCls));
      const expiresAt = new Date(Date.now() + 60_000);
      const challenge = (id: string, tenantId: string, publisherClaimId: string, method: "EMAIL" | "LISTING") => prisma.publisherClaimChallenge.create({
        data: { id, tenantId, publisherClaimId, method, codeDigest: "hmac-digest", recipientFingerprint: "recipient-fingerprint", expiresAt },
      });
      const inserted = await challenge(emailChallenge, tenantA, claimA, "EMAIL");
      expect(inserted).toMatchObject({
        id: emailChallenge, method: "EMAIL", codeDigest: "hmac-digest",
        recipientFingerprint: "recipient-fingerprint", attempts: 0, consumedAt: null, expiresAt,
      });
      expect(inserted.issuedAt).toBeInstanceOf(Date);
      const consumedAt = new Date();
      const consumed = await prisma.publisherClaimChallenge.update({ where: { id: emailChallenge }, data: { attempts: 2, consumedAt } });
      expect(consumed).toMatchObject({ attempts: 2, consumedAt });

      await expect(challenge(missingTenantChallenge, missingTenant, claimA, "EMAIL"))
        .rejects.toMatchObject({ code: "P2003" });
      await expect(challenge(missingClaimChallenge, tenantA, missingClaim, "EMAIL"))
        .rejects.toMatchObject({ code: "P2003" });

      const listing = await challenge(listingChallenge, tenantB, claimB, "LISTING");
      expect(listing.method).toBe("LISTING");

      // Claim FK is claim-id-only: this mismatched pair is accepted, not tenant isolation.
      const mismatch = await challenge(mismatchChallenge, tenantB, claimA, "LISTING");
      expect(mismatch).toMatchObject({ tenantId: tenantB, publisherClaimId: claimA, method: "LISTING" });

      activeTenantId = tenantA;
      const visibleToA = await tenantPrisma.publisherClaimChallenge.findMany({ where: { id: { in: challengeIds } } });
      expect(visibleToA.map(({ id }) => id)).toEqual([emailChallenge]);
      activeTenantId = tenantB;
      const visibleToB = await tenantPrisma.publisherClaimChallenge.findMany({ where: { id: { in: challengeIds } } });
      expect(visibleToB.map(({ id }) => id).sort()).toEqual([listingChallenge, mismatchChallenge].sort());
    } finally {
      for (const id of challengeIds) await prisma.$executeRaw`DELETE FROM "publisher_claim_challenges" WHERE "id" = ${id}`;
      await prisma.publisherClaim.deleteMany({ where: { id: { in: claimIds } } });
      await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    }
  });

  it("stores only code digests and recipient fingerprints with bounded lifecycle metadata", () => {
    const source = schema();
    const model = /model PublisherClaimChallenge\s*\{([^}]*)\}/.exec(source)?.[1] ?? "";
    expect(model).toMatch(/^\s*tenantId\s+String/m);
    expect(model).toMatch(/^\s*publisherClaimId\s+String/m);
    expect(model).toMatch(/^\s*method\s+PublisherClaimChallengeMethod/m);
    expect(model).toMatch(/^\s*codeDigest\s+String/m);
    expect(model).toMatch(/^\s*recipientFingerprint\s+String/m);
    expect(model).toMatch(/^\s*attempts\s+Int/m);
    for (const field of ["issuedAt", "expiresAt", "consumedAt"]) expect(model).toMatch(new RegExp(`^\\s*${field}\\s+DateTime`, "m"));
    expect(model).not.toMatch(/plain(?:text)?Code|rawEmail|recipientEmail/i);
    expect(model).toMatch(/@@index\(\[tenantId, recipientFingerprint, issuedAt\]\)/);
    expect(model).toMatch(/@@index\(\[publisherClaimId, method, issuedAt\]\)/);
    expect(model).toMatch(/Claim\/tenant equality is enforced by the issuing\/verifying transaction/);
    expect(TENANT_OWNED_MODELS.has("PublisherClaimChallenge")).toBe(true);
  });
});
