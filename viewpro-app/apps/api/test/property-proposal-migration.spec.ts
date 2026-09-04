import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { withPropertyProposalCleanup } from "./property-proposal-cleanup";

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
	url.searchParams.set("options", "-c statement_timeout=8000 -c lock_timeout=5000");
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
		await withPropertyProposalCleanup(
			() => migratedClient(`property-proposal-migration-${suffix}`),
			{
				sourceEngagementIds: [ids.source, ids.direct],
				orphanAssetIds: [ids.asset],
				proposalIds: [ids.proposal],
				tenantIds: [ids.tenantA, ids.tenantB],
				userIds: [ids.user],
			},
			async (prisma) => {
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
			).rejects.toThrow("Foreign key constraint violated");
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
				).rejects.toThrow("Unique constraint failed");
			},
		);
	}, 20_000);
});
