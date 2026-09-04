import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	resolve(
		process.cwd(),
		"prisma/migrations/20260902120000_add_property_proposals/migration.sql",
	),
	"utf8",
);

function migratedClient(applicationName: string) {
	const url = new URL(process.env.DATABASE_URL ?? "");
	url.searchParams.set("application_name", applicationName);
	url.searchParams.set("connect_timeout", "3");
	url.searchParams.set("connection_limit", "1");
	return new PrismaClient({ datasources: { db: { url: url.toString() } } });
}

type FixtureIds = {
	tenantA: string;
	tenantB: string;
	user: string;
	proposal: string;
	asset: string;
	source: string;
	direct: string;
};

async function cleanFixture(prisma: PrismaClient, ids: FixtureIds) {
	const steps = [
		() => prisma.propertyEngagement.deleteMany({ where: { id: { in: [ids.source, ids.direct] } } }),
		() => prisma.propertyAsset.deleteMany({ where: { id: ids.asset } }),
		() => prisma.propertyProposal.deleteMany({ where: { id: ids.proposal } }),
		() => prisma.tenant.deleteMany({ where: { id: { in: [ids.tenantA, ids.tenantB] } } }),
		() => prisma.user.deleteMany({ where: { id: ids.user } }),
	];
	const failures: unknown[] = [];
	for (const step of steps) {
		try {
			await step();
		} catch (error) {
			failures.push(error);
		}
	}
	if (failures.length > 0) {
		throw new AggregateError(failures, "property proposal migration fixture cleanup failed");
	}
}

describe("property proposal additive migration", () => {
	it("creates deployable proposal persistence with local bounds and a validated source FK", () => {
		expect(migration).toMatch(
			/CREATE TYPE "PropertyProposalStatus" AS ENUM \('BORRADOR', 'EN_REVISION', 'APROBADA', 'RECHAZADA'\)/,
		);
		for (const table of [
			"property_proposals",
			"property_proposal_review_rounds",
			"property_proposal_review_decisions",
		]) {
			expect(migration).toMatch(new RegExp(`CREATE TABLE "${table}"`));
		}
		expect(migration).toMatch(
			/BEGIN;\s+SET LOCAL lock_timeout = '5s';\s+SET LOCAL statement_timeout = '30s';[\s\S]+?CREATE TYPE "PropertyProposalStatus"[\s\S]+?COMMIT;/,
		);
		expect(migration).toMatch(/ADD COLUMN "sourceProposalId" TEXT/);
		expect(migration).toMatch(
			/FOREIGN KEY \("sourceProposalId", "tenantId"\)\s+REFERENCES "property_proposals"\("id", "tenantId"\)\s+ON DELETE NO ACTION\s+ON UPDATE RESTRICT\s+NOT VALID/,
		);
		expect(migration).toMatch(
			/ALTER TABLE "property_engagements"\s+VALIDATE CONSTRAINT "property_engagements_sourceProposalId_tenantId_fkey";\s+COMMIT;/,
		);
	});

	it("works through the migrated generated client and rejects invalid proposal sources", async () => {
		const suffix = randomUUID();
		const ids: FixtureIds = {
			tenantA: `tenant-a-${suffix}`,
			tenantB: `tenant-b-${suffix}`,
			user: `user-${suffix}`,
			proposal: `proposal-${suffix}`,
			asset: `asset-${suffix}`,
			source: `source-${suffix}`,
			direct: `direct-${suffix}`,
		};
		const prisma = migratedClient(`property-proposal-migration-${suffix}`);

		try {
			await prisma.tenant.createMany({
				data: [ids.tenantA, ids.tenantB].map((id) => ({ id, name: id, slug: id })),
			});
			await prisma.user.create({
				data: {
					id: ids.user,
					email: `${suffix}@example.test`,
					passwordHash: "test",
					firstName: "Proposal",
				},
			});
			await prisma.propertyProposal.create({
				data: {
					id: ids.proposal,
					tenantId: ids.tenantA,
					proposedByUserId: ids.user,
					title: "Migration source",
				},
			});
			await prisma.propertyAsset.create({
				data: {
					id: ids.asset,
					title: "Migration asset",
					addressLine: "1 Test Street",
					city: "Test",
					province: "Test",
					propertyType: "HOUSE",
					createdByUserId: ids.user,
				},
			});
			const source = await prisma.propertyEngagement.create({
				data: {
					id: ids.source,
					tenantId: ids.tenantA,
					propertyAssetId: ids.asset,
					operationType: "SALE",
					createdByUserId: ids.user,
					sourceProposalId: ids.proposal,
				},
			});
			expect(source.sourceProposalId).toBe(ids.proposal);
			const direct = await prisma.propertyEngagement.create({
				data: {
					id: ids.direct,
					tenantId: ids.tenantA,
					propertyAssetId: ids.asset,
					operationType: "SALE",
					createdByUserId: ids.user,
				},
			});
			expect(direct.sourceProposalId).toBeNull();
			await expect(
				prisma.propertyEngagement.create({
					data: {
						tenantId: ids.tenantA,
						propertyAssetId: ids.asset,
						operationType: "SALE",
						createdByUserId: ids.user,
						sourceProposalId: ids.proposal,
					},
				}),
			).rejects.toThrow();
			await expect(
				prisma.propertyEngagement.create({
					data: {
						tenantId: ids.tenantB,
						propertyAssetId: ids.asset,
						operationType: "SALE",
						createdByUserId: ids.user,
						sourceProposalId: ids.proposal,
					},
				}),
			).rejects.toThrow();
		} finally {
			try {
				await cleanFixture(prisma, ids);
			} finally {
				await prisma.$disconnect();
			}
		}
	}, 20_000);
});
