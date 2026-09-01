import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { runCleanupSteps } from "./cleanup-steps";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const schemaPath = join(appRoot, "apps/api/prisma/schema.prisma");
const migrationsRoot = join(appRoot, "apps/api/prisma/migrations");

function propertyAgentPrimaryMigrationPath() {
	const migration = readdirSync(migrationsRoot).find((name) =>
		name.endsWith("_add_property_agent_primary"),
	);
	if (!migration) {
		throw new Error("missing property-agent primary migration");
	}
	return join(migrationsRoot, migration, "migration.sql");
}

const primaryIndexName = "property_agents_one_primary_per_engagement";
const prisma = new PrismaClient();

async function applyCandidateMigration(sql: string) {
	for (const statement of sql.split(";")) {
		if (statement.trim()) {
			await prisma.$executeRawUnsafe(statement);
		}
	}
}

async function removeCandidateSchema() {
	await runCleanupSteps([
		{
			name: "drop primary index",
			run: async () => prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "${primaryIndexName}"`),
		},
		{
			name: "drop primary column",
			run: async () => prisma.$executeRawUnsafe('ALTER TABLE "property_agents" DROP COLUMN IF EXISTS "isPrimary"'),
		},
	]);
}

async function restoreExpectedCandidateSchema() {
	await runCleanupSteps([
		{
			name: "ensure primary column",
			run: async () =>
				prisma.$executeRawUnsafe(
					'ALTER TABLE "property_agents" ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN NOT NULL DEFAULT FALSE',
				),
		},
		{
			name: "restore primary default",
			run: async () =>
				prisma.$executeRawUnsafe('ALTER TABLE "property_agents" ALTER COLUMN "isPrimary" SET DEFAULT FALSE'),
		},
		{
			name: "restore primary non-null constraint",
			run: async () =>
				prisma.$executeRawUnsafe('ALTER TABLE "property_agents" ALTER COLUMN "isPrimary" SET NOT NULL'),
		},
		{
			name: "drop primary index before recreation",
			run: async () => prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "${primaryIndexName}"`),
		},
		{
			name: "recreate primary index",
			run: async () =>
				prisma.$executeRawUnsafe(
					`CREATE UNIQUE INDEX "${primaryIndexName}" ON "property_agents" ("propertyEngagementId") WHERE "isPrimary" = TRUE`,
				),
		},
	]);
}

async function restoreCandidateSchema(sql: string) {
	try {
		await runCleanupSteps([
			{
				name: "remove candidate schema",
				run: removeCandidateSchema,
			},
			{
				name: "replay candidate migration",
				run: async () => applyCandidateMigration(sql),
			},
		]);
	} catch (candidateReplayFailure) {
		try {
			await restoreExpectedCandidateSchema();
		} catch (expectedSchemaRestoreFailure) {
			throw new AggregateError(
				[candidateReplayFailure, expectedSchemaRestoreFailure],
				"Candidate migration replay and independent schema restoration both failed",
			);
		}
		throw candidateReplayFailure;
	}
}

async function removeSeedRecords(input: {
	tenantId: string;
	propertyAssetId: string;
	userIds: string[];
}) {
	await runCleanupSteps([
		{
			name: "remove seed tenant",
			run: async () => void (await prisma.tenant.deleteMany({ where: { id: input.tenantId } })),
		},
		{
			name: "remove seed property asset",
			run: async () => void (await prisma.propertyAsset.deleteMany({ where: { id: input.propertyAssetId } })),
		},
		{
			name: "remove seed users",
			run: async () => void (await prisma.user.deleteMany({ where: { id: { in: input.userIds } } })),
		},
	]);
}

afterAll(async () => {
	await prisma.$disconnect();
});

describe("PropertyAgent primary persistence contract", () => {
	it("declares a false-default primary flag with the raw-SQL invariant documented beside it", () => {
		const schema = readFileSync(schemaPath, "utf8");
		const propertyAgent = schema.match(/model PropertyAgent \{[\s\S]*?\n\}/)?.[0] ?? "";

		expect(propertyAgent).toMatch(
			/Raw-SQL partial-index invariant:[\s\S]*?isPrimary\s+Boolean\s+@default\(false\)/,
		);
	});

	it("adds only the false-default column and named one-primary partial index without selecting existing assignments", () => {
		const sql = readFileSync(propertyAgentPrimaryMigrationPath(), "utf8");

		expect(sql).toMatch(
			/ALTER TABLE "property_agents"\s+ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT FALSE;/,
		);
		expect(sql).toMatch(
			/CREATE UNIQUE INDEX "property_agents_one_primary_per_engagement"\s+ON "property_agents" \("propertyEngagementId"\)\s+WHERE "isPrimary" = TRUE;/,
		);
		expect(sql).not.toMatch(/\b(?:UPDATE|INSERT|SELECT|WITH)\b/i);
	});

	it("migrates pre-existing assignments to no primary and enforces the named partial index", async () => {
		const suffix = randomUUID();
		const tenantId = `primary-tenant-${suffix}`;
		const creatorId = `primary-creator-${suffix}`;
		const firstAgentId = `primary-agent-one-${suffix}`;
		const secondAgentId = `primary-agent-two-${suffix}`;
		const propertyAssetId = `primary-asset-${suffix}`;
		const engagementId = `primary-engagement-${suffix}`;
		const firstAssignmentId = `primary-assignment-one-${suffix}`;
		const secondAssignmentId = `primary-assignment-two-${suffix}`;
		const candidateMigrationSql = readFileSync(propertyAgentPrimaryMigrationPath(), "utf8");
		const seed = {
			tenantId,
			propertyAssetId,
			userIds: [creatorId, firstAgentId, secondAgentId],
		};

		try {
			await prisma.tenant.create({
				data: { id: tenantId, name: "Primary schema tenant", slug: `primary-${suffix}` },
			});
			await prisma.user.createMany({
				data: [
					{ id: creatorId, email: `creator-${suffix}@example.test`, passwordHash: "test", firstName: "Creator" },
					{ id: firstAgentId, email: `first-${suffix}@example.test`, passwordHash: "test", firstName: "First" },
					{ id: secondAgentId, email: `second-${suffix}@example.test`, passwordHash: "test", firstName: "Second" },
				],
			});
			await prisma.propertyAsset.create({
				data: {
					id: propertyAssetId,
					title: "Primary schema asset",
					addressLine: "Test 1",
					city: "Test city",
					province: "Test province",
					propertyType: "APARTMENT",
					createdByUserId: creatorId,
				},
			});
			await prisma.propertyEngagement.create({
				data: {
					id: engagementId,
					tenantId,
					propertyAssetId,
					operationType: "SALE",
					createdByUserId: creatorId,
				},
			});
			await prisma.$executeRaw`
				INSERT INTO "property_agents" ("id", "tenantId", "propertyEngagementId", "agentUserId", "assignedByUserId")
				VALUES
					(${firstAssignmentId}, ${tenantId}, ${engagementId}, ${firstAgentId}, ${creatorId}),
					(${secondAssignmentId}, ${tenantId}, ${engagementId}, ${secondAgentId}, ${creatorId})
			`;

			await removeCandidateSchema();
			expect(await prisma.$queryRaw<Array<{ column_name: string }>>`
				SELECT column_name FROM information_schema.columns
				WHERE table_schema = current_schema()
					AND table_name = 'property_agents'
					AND column_name = 'isPrimary'
			`).toEqual([]);
			await applyCandidateMigration(candidateMigrationSql);

			const assignments = await prisma.$queryRaw<Array<{ id: string; isPrimary: boolean }>>`
				SELECT "id", "isPrimary" FROM "property_agents"
				WHERE "propertyEngagementId" = ${engagementId}
				ORDER BY "id"
			`;
			expect(assignments).toEqual([
				{ id: firstAssignmentId, isPrimary: false },
				{ id: secondAssignmentId, isPrimary: false },
			]);
			expect(await prisma.$queryRaw<Array<{ count: bigint }>>`
				SELECT COUNT(*)::bigint AS "count" FROM "property_agents"
				WHERE "propertyEngagementId" = ${engagementId} AND "isPrimary" = TRUE
			`).toEqual([{ count: 0n }]);

			const [primaryIndex] = await prisma.$queryRaw<Array<{ indexdef: string }>>`
				SELECT indexdef FROM pg_indexes
				WHERE schemaname = current_schema() AND indexname = ${primaryIndexName}
			`;
			expect(primaryIndex).toBeDefined();
			expect(primaryIndex.indexdef).toMatch(
				/UNIQUE INDEX property_agents_one_primary_per_engagement[\s\S]*WHERE \("isPrimary" = true\)/,
			);
			await prisma.$executeRaw`
				UPDATE "property_agents" SET "isPrimary" = TRUE WHERE "id" = ${firstAssignmentId}
			`;
			expect(await prisma.$queryRaw<Array<{ count: bigint }>>`
				SELECT COUNT(*)::bigint AS "count" FROM "property_agents"
				WHERE "propertyEngagementId" = ${engagementId} AND "isPrimary" = TRUE
			`).toEqual([{ count: 1n }]);
			await expect(prisma.$executeRaw`
				UPDATE "property_agents" SET "isPrimary" = TRUE WHERE "id" = ${secondAssignmentId}
			`).rejects.toThrow("Code: `23505`");
		} finally {
			await runCleanupSteps([
				{
					name: "restore candidate schema",
					run: async () => restoreCandidateSchema(candidateMigrationSql),
				},
				{
					name: "remove seed records",
					run: async () => removeSeedRecords(seed),
				},
			]);
		}
	});
});
