import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { TENANT_OWNED_MODELS } from "../src/database/tenant-isolation.extension";

const prisma = new PrismaClient();
const appRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const migrationsRoot = join(appRoot, "apps/api/prisma/migrations");
const migrationPath = () => {
  const name = readdirSync(migrationsRoot).find((entry) => entry.endsWith("_add_external_references_and_publisher_claims"));
  if (!name) throw new Error("missing external-reference/publisher-claim migration");
  return join(migrationsRoot, name, "migration.sql");
};
const uniqueViolation = (action: () => Promise<unknown>) => expect(action()).rejects.toMatchObject({ code: "P2002" });

afterAll(async () => prisma.$disconnect());

describe("external reference and publisher claim persistence", () => {
  it("registers every direct-tenant schema model", () => {
    const schema = readFileSync(join(appRoot, "apps/api/prisma/schema.prisma"), "utf8");
    const models = new Set<string>();
    for (const match of schema.matchAll(/model\s+(\w+)\s*\{([^}]*)\}/g)) {
      if (/^\s*tenantId\s+String/m.test(match[2] ?? "")) models.add(match[1]!);
    }
    expect([...models].sort()).toEqual([...TENANT_OWNED_MODELS].sort());
    for (const name of ["ExternalPropertyReference", "PublisherClaim", "PublisherClaimEvent"]) {
      expect(TENANT_OWNED_MODELS.has(name)).toBe(true);
    }
  });

  it("enforces tenant reference uniqueness and approved-only publisher exclusivity", async () => {
    const suffix = randomUUID();
    const tenantA = `reference-a-${suffix}`;
    const tenantB = `reference-b-${suffix}`;
    const userId = `reference-user-${suffix}`;
    const assetId = `reference-asset-${suffix}`;
    const engagementA = `reference-engagement-a-${suffix}`;
    const engagementB = `reference-engagement-b-${suffix}`;
    const externalId = `listing-${suffix}`;
    const publisherId = `publisher-${suffix}`;
    const insertClaim = (id: string, tenantId: string, state: "PENDING" | "APPROVED" | "REVOKED") =>
      prisma.publisherClaim.create({ data: { id, externalSource: "ZONAPROP", publisherId, tenantId, state } });
    try {
      await prisma.tenant.createMany({ data: [
        { id: tenantA, name: "Reference A", slug: `reference-a-${suffix}` },
        { id: tenantB, name: "Reference B", slug: `reference-b-${suffix}` },
      ] });
      await prisma.user.create({ data: { id: userId, email: `${suffix}@example.test`, passwordHash: "test", firstName: "Test" } });
      await prisma.propertyAsset.create({ data: { id: assetId, title: "Reference test", addressLine: "Test 1", city: "Test", province: "Test", propertyType: "OTHER", createdByUserId: userId } });
      await prisma.propertyEngagement.createMany({ data: [
        { id: engagementA, tenantId: tenantA, propertyAssetId: assetId, operationType: "SALE", createdByUserId: userId },
        { id: engagementB, tenantId: tenantB, propertyAssetId: assetId, operationType: "SALE", createdByUserId: userId },
      ] });
      await prisma.externalPropertyReference.createMany({ data: [
        { id: `ref-a-${suffix}`, tenantId: tenantA, externalSource: "ZONAPROP", externalId, propertyEngagementId: engagementA },
        { id: `ref-b-${suffix}`, tenantId: tenantB, externalSource: "ZONAPROP", externalId, propertyEngagementId: engagementB },
      ] });
      await uniqueViolation(() => prisma.externalPropertyReference.create({ data: {
        id: `ref-duplicate-${suffix}`, tenantId: tenantA, externalSource: "ZONAPROP", externalId, propertyEngagementId: engagementA,
      } }));

      await insertClaim(`pending-a-${suffix}`, tenantA, "PENDING");
      await insertClaim(`pending-b-${suffix}`, tenantB, "PENDING");
      const approvedId = `approved-${suffix}`;
      await insertClaim(approvedId, tenantA, "APPROVED");
      await insertClaim(`pending-with-approved-${suffix}`, tenantB, "PENDING");
      await uniqueViolation(() => insertClaim(`second-approved-${suffix}`, tenantB, "APPROVED"));
      await prisma.publisherClaim.update({ where: { id: approvedId }, data: { state: "REVOKED" } });
      await insertClaim(`approved-after-revoke-${suffix}`, tenantB, "APPROVED");
      expect(readFileSync(migrationPath(), "utf8")).toMatch(
        /CREATE UNIQUE INDEX "publisher_claims_one_approved_per_publisher"[\s\S]*WHERE "state" = 'APPROVED'/,
      );
    } finally {
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
      await prisma.propertyAsset.deleteMany({ where: { id: assetId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  });
});
