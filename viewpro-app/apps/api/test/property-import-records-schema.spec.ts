/* oxlint-disable vitest/expect-expect -- uniqueness assertions run through the awaited uniqueViolation helper. */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { TENANT_OWNED_MODELS } from "../src/database/tenant-isolation.extension";

const prisma = new PrismaClient();
const appRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
afterAll(async () => prisma.$disconnect());
const uniqueViolation = (action: () => Promise<unknown>) => expect(action()).rejects.toMatchObject({ code: "P2002" });

describe("property import records schema", () => {
  it("keeps the direct-tenant schema models and isolation registry in parity", () => {
    const schema = readFileSync(join(appRoot, "apps/api/prisma/schema.prisma"), "utf8");
    const schemaModels = new Set<string>();
    for (const match of schema.matchAll(/model\s+(\w+)\s*\{([^}]*)\}/g)) {
      if (/^\s*tenantId\s+String/m.test(match[2] ?? "")) schemaModels.add(match[1]!);
    }
    expect(schemaModels).toEqual(expect.objectContaining(new Set([
      "PropertyImportBatch", "PropertyImportCandidate", "PropertyImportWork",
    ])));
    expect([...schemaModels].sort()).toEqual([...TENANT_OWNED_MODELS].sort());
  });

  it("enforces per-batch candidate and per-tenant work idempotency uniqueness", async () => {
    const suffix = randomUUID();
    const tenants = [`import-a-${suffix}`, `import-b-${suffix}`];
    const userId = `import-user-${suffix}`;
    try {
      await prisma.tenant.createMany({ data: tenants.map((id, index) => ({ id, name: id, slug: `${id}-${index}` })) });
      await prisma.user.create({ data: { id: userId, email: `${suffix}@example.test`, passwordHash: "test", firstName: "Test" } });
      const batches = [`batch-a-${suffix}`, `batch-b-${suffix}`];
      for (let index = 0; index < 2; index++) {
        await prisma.propertyImportBatch.create({ data: {
          id: batches[index], tenantId: tenants[index], initiatedByUserId: userId,
          externalSource: "ZONAPROP", canonicalUrl: `https://www.zonaprop.com.ar/${index}`,
          publisherId: "publisher",
        } });
      }
      const candidate = (id: string, batchId: string) => prisma.propertyImportCandidate.create({ data: {
        id, tenantId: tenants[0], batchId, externalId: "listing-1", sourceUrl: "https://www.zonaprop.com.ar/listing-1",
        sourceSnapshot: {}, snapshotExpiresAt: new Date(Date.now() + 86400000),
      } });
      await candidate(`candidate-a-${suffix}`, batches[0]);
      await uniqueViolation(() => candidate(`candidate-duplicate-${suffix}`, batches[0]));
      await candidate(`candidate-b-${suffix}`, batches[1]);
      const work = (tenantId: string) => prisma.propertyImportWork.create({ data: {
        tenantId, batchId: tenantId === tenants[0] ? batches[0] : batches[1], kind: "DISCOVERY",
        idempotencyKey: "same-key",
      } });
      await work(tenants[0]);
      await uniqueViolation(() => work(tenants[0]));
      await work(tenants[1]);
    } finally {
      await prisma.tenant.deleteMany({ where: { id: { in: tenants } } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  });

  it("allows a candidate to link to an external property reference", async () => {
    const suffix = randomUUID();
    const tenantId = `import-link-${suffix}`;
    const userId = `import-user-${suffix}`;
    try {
      await prisma.tenant.create({ data: { id: tenantId, name: tenantId, slug: tenantId } });
      await prisma.user.create({ data: { id: userId, email: `${suffix}@example.test`, passwordHash: "test", firstName: "Test" } });
      const asset = await prisma.propertyAsset.create({ data: {
        title: "Import", addressLine: "1 Test St", city: "Test", province: "Test", propertyType: "OTHER", createdByUserId: userId,
      } });
      const engagement = await prisma.propertyEngagement.create({ data: {
        tenantId, propertyAssetId: asset.id, operationType: "SALE", createdByUserId: userId,
      } });
      const batch = await prisma.propertyImportBatch.create({ data: {
        tenantId, initiatedByUserId: userId, externalSource: "ZONAPROP", canonicalUrl: "https://www.zonaprop.com.ar/test", publisherId: "p",
      } });
      const reference = await prisma.externalPropertyReference.create({ data: {
        tenantId, externalSource: "ZONAPROP", externalId: "listing", propertyEngagementId: engagement.id,
      } });
      const candidate = await prisma.propertyImportCandidate.create({ data: {
        tenantId, batchId: batch.id, externalId: "listing", sourceUrl: "https://www.zonaprop.com.ar/listing",
        sourceSnapshot: {}, snapshotExpiresAt: new Date(Date.now() + 86400000), resultingReferenceId: reference.id,
      } });
      expect(candidate.resultingReferenceId).toBe(reference.id);
    } finally {
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
      await prisma.propertyAsset.deleteMany({ where: { createdByUserId: userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  });
});
