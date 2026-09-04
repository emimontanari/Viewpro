import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { runCleanupSteps } from "./cleanup-steps";

const migration = readFileSync(
	resolve(process.cwd(), "prisma/migrations/20260902120000_add_property_proposals/migration.sql"),
	"utf8",
);
const normalStatementTimeoutMs = 8_000;
const statementBudgetMs = 30_000;
const observerStatementTimeoutMs = 500;
const lockTimeoutMs = 5_000;
const fullDdlTransactionTimeoutMs = statementBudgetMs + 5_000;
const observationDeadlineMs = 2_000;
const disconnectDeadlineMs = 5_000;
const productionShapedEngagementRows = 40_000;

function client(applicationName: string, statementTimeoutMs = normalStatementTimeoutMs) {
	const url = new URL(process.env.DATABASE_URL ?? "");
	url.searchParams.set("application_name", applicationName);
	url.searchParams.set("connect_timeout", "3");
	url.searchParams.set("connection_limit", "1");
	url.searchParams.set(
		"options",
		`-c statement_timeout=${statementTimeoutMs} -c lock_timeout=${lockTimeoutMs}`,
	);
	return new PrismaClient({ datasources: { db: { url: url.toString() } } });
}

function quote(identifier: string) {
	return `"${identifier.replaceAll('"', '""')}"`;
}

function normalized(sql: string) {
	return sql.replace(/\s+/g, " ").trim();
}

function sourceDdl() {
	const statements = [
		...(migration.match(
			/^CREATE UNIQUE INDEX "property_engagements_sourceProposalId(?:_tenantId)?_key" ON "property_engagements"\("sourceProposalId"(?:, "tenantId")?\);$/gm,
		) ?? []),
		...(migration.match(
			/ALTER TABLE "property_engagements" ADD CONSTRAINT "property_engagements_sourceProposalId_tenantId_fkey"[\s\S]*?NOT VALID;/g,
		) ?? []),
		...(migration.match(
			/ALTER TABLE "property_engagements" VALIDATE CONSTRAINT "property_engagements_sourceProposalId_tenantId_fkey";/g,
		) ?? []),
	];
	expect(statements).toHaveLength(4);
	return statements;
}

function scratchDdl(statement: string, names: Record<string, string>) {
	return Object.entries(names).reduce(
		(sql, [source, scratch]) => sql.replaceAll(quote(source), quote(scratch)),
		statement,
	);
}

async function transaction<T>(
	prisma: PrismaClient,
	work: (tx: Prisma.TransactionClient) => Promise<T>,
	timeoutMs = normalStatementTimeoutMs,
) {
	return prisma.$transaction(work, { maxWait: 3_000, timeout: timeoutMs });
}

async function configureClient(prisma: PrismaClient) {
	const [backend] = await prisma.$queryRawUnsafe<{ pid: number }[]>(
		"SELECT pg_backend_pid() AS pid",
	);
	return backend.pid;
}

function delay(milliseconds: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForBarrier(name: string, milliseconds: number, barrier: Promise<void>) {
	let timeout: NodeJS.Timeout | undefined;
	const deadline = new Promise<never>((resolve, reject) => {
		void resolve;
		timeout = setTimeout(() => reject(new Error(`${name} exceeded ${milliseconds}ms`)), milliseconds);
	});
	try {
		await Promise.race([barrier, deadline]);
	} finally {
		clearTimeout(timeout);
	}
}

async function disconnectWithDeadline(prisma: PrismaClient, name: string) {
	let timeout: NodeJS.Timeout | undefined;
	const deadline = new Promise<never>((resolve, reject) => {
		void resolve;
		timeout = setTimeout(
			() => reject(new Error(`${name} disconnect exceeded ${disconnectDeadlineMs}ms`)),
			disconnectDeadlineMs,
		);
	});
	try {
		await Promise.race([prisma.$disconnect(), deadline]);
	} finally {
		clearTimeout(timeout);
	}
}

async function observeExactBlock(
	observer: PrismaClient,
	builderPid: number,
	writerPid: number,
) {
	const deadline = performance.now() + observationDeadlineMs;
	while (performance.now() + observerStatementTimeoutMs < deadline) {
		const [activity] = await observer.$queryRawUnsafe<
			{ wait_event_type: string | null; blockers: number[] }[]
		>(
			`SELECT wait_event_type, pg_blocking_pids(pid) AS blockers ` +
				`FROM pg_stat_activity WHERE pid = ${builderPid}`,
		);
		if (activity?.wait_event_type === "Lock" && activity.blockers.includes(writerPid)) {
			return activity;
		}
		await delay(Math.min(25, Math.max(0, deadline - performance.now())));
	}
	expect.fail(`builder PID ${builderPid} did not block on writer PID ${writerPid} within ${observationDeadlineMs}ms`);
}

function fixture(suffix: string) {
	const id = (name: string) => `c2b-${name}-${suffix}`;
	return {
		tenantA: id("tenant-a"),
		tenantB: id("tenant-b"),
		user: id("user"),
		proposalA: id("proposal-a"),
		proposalB: id("proposal-b"),
		assetA: id("asset-a"),
		assetB: id("asset-b"),
		source: id("source"),
		direct: id("direct"),
	};
}

function cleanupIds(ids: ReturnType<typeof fixture>) {
	return {
		sourceEngagementIds: [ids.source, ids.direct],
		capturedAssetIds: [ids.assetA, ids.assetB],
		proposalIds: [ids.proposalA, ids.proposalB],
		tenantIds: [ids.tenantA, ids.tenantB],
		userIds: [ids.user],
	};
}

async function cleanFixture(prisma: PrismaClient, ids: ReturnType<typeof fixture>) {
	await runCleanupSteps([
		{
			name: "source engagements",
			run: () =>
				prisma.propertyEngagement.deleteMany({
					where: { id: { in: ids.sourceEngagementIds } },
				}),
		},
		{
			name: "captured orphan assets",
			run: () =>
				prisma.propertyAsset.deleteMany({
					where: { id: { in: ids.capturedAssetIds } },
				}),
		},
		{
			name: "proposals",
			run: () => prisma.propertyProposal.deleteMany({ where: { id: { in: ids.proposalIds } } }),
		},
		{
			name: "tenants",
			run: () => prisma.tenant.deleteMany({ where: { id: { in: ids.tenantIds } } }),
		},
		{
			name: "user",
			run: () => prisma.user.deleteMany({ where: { id: { in: ids.userIds } } }),
		},
	]);
}

async function preserveFixtureAndDisconnect(
	prisma: PrismaClient,
	ids: ReturnType<typeof fixture>,
	work: () => Promise<void>,
) {
	let workFailure: unknown;
	try {
		await work();
	} catch (error) {
		workFailure = error;
	}

	const cleanupFailures: unknown[] = [];
	for (const step of [
		() => cleanFixture(prisma, cleanupIds(ids)),
		() => prisma.$disconnect(),
	]) {
		try {
			await step();
		} catch (error) {
			cleanupFailures.push(error);
		}
	}

	if (workFailure && cleanupFailures.length > 0) {
		throw new AggregateError([workFailure, ...cleanupFailures], "fixture work and cleanup failed");
	}
	if (workFailure) throw workFailure;
	if (cleanupFailures.length > 0) {
		throw new AggregateError(cleanupFailures, "fixture cleanup failed");
	}
}

async function setupFixture(prisma: PrismaClient, ids: ReturnType<typeof fixture>) {
	await prisma.tenant.createMany({
		data: [ids.tenantA, ids.tenantB].map((id) => ({ id, name: id, slug: id })),
	});
	await prisma.user.create({
		data: {
			id: ids.user,
			email: `${ids.user}@example.test`,
			passwordHash: "test",
			firstName: "Test",
		},
	});
	await prisma.propertyProposal.createMany({
		data: [ids.proposalA, ids.proposalB].map((id) => ({
			id,
			tenantId: ids.tenantA,
			proposedByUserId: ids.user,
			title: "Duplicate",
			addressLine: "Same address",
		})),
	});
	return Promise.all(
		Array.from({ length: 8 }, (_, index) =>
			prisma.propertyProposalReviewRound.create({
				data: {
					id: `${ids.proposalA}-round-${index}`,
					tenantId: ids.tenantA,
					proposalId: ids.proposalA,
					roundNumber: index + 1,
					submittedByUserId: ids.user,
					title: "Round",
				},
			}),
		),
	);
}

async function assertDecisions(
	prisma: PrismaClient,
	ids: ReturnType<typeof fixture>,
	rounds: { id: string }[],
) {
	const decision = (index: number, outcome: "APPROVED" | "REJECTED", reason: string | null) =>
		prisma.propertyProposalReviewDecision.create({
			data: {
				tenantId: ids.tenantA,
				reviewRoundId: rounds[index].id,
				reviewerUserId: ids.user,
				outcome,
				rejectionReason: reason,
			},
		});
	for (const [index, reason] of [[0, null], [1, ""], [2, "   "], [3, "x".repeat(1001)]] as const) {
		await expect(decision(index, "REJECTED", reason)).rejects.toThrow(/constraint|invalid/i);
	}
	await expect(decision(4, "REJECTED", "x")).resolves.toMatchObject({ rejectionReason: "x" });
	await expect(decision(5, "REJECTED", "x".repeat(1000))).resolves.toMatchObject({
		rejectionReason: "x".repeat(1000),
	});
	await expect(decision(6, "APPROVED", null)).resolves.toMatchObject({ rejectionReason: null });
	await expect(decision(7, "APPROVED", "not allowed")).rejects.toThrow(/constraint|invalid/i);
}

async function assertSourceRules(
	prisma: PrismaClient,
	ids: ReturnType<typeof fixture>,
	roundId: string,
) {
	await expect(
		prisma.propertyProposalReviewRound.create({
			data: {
				id: `${ids.proposalA}-cross`, tenantId: ids.tenantB, proposalId: ids.proposalA,
				roundNumber: 9, submittedByUserId: ids.user, title: "Cross",
			},
		}),
	).rejects.toThrow(/foreign key|constraint/i);
	await expect(
		prisma.propertyProposalReviewDecision.create({
			data: {
				tenantId: ids.tenantB, reviewRoundId: roundId, reviewerUserId: ids.user,
				outcome: "APPROVED",
			},
		}),
	).rejects.toThrow(/foreign key|constraint/i);
	await prisma.propertyAsset.createMany({
		data: [ids.assetA, ids.assetB].map((id) => ({
			id, title: id, addressLine: "1 Test", city: "Test", province: "Test",
			propertyType: "HOUSE", createdByUserId: ids.user,
		})),
	});
	await prisma.propertyEngagement.create({
		data: {
			id: ids.source, tenantId: ids.tenantA, propertyAssetId: ids.assetA,
			operationType: "SALE", createdByUserId: ids.user, sourceProposalId: ids.proposalA,
		},
	});
	await expect(
		prisma.propertyEngagement.create({
			data: {
				tenantId: ids.tenantA, propertyAssetId: ids.assetB, operationType: "SALE",
				createdByUserId: ids.user, sourceProposalId: ids.proposalA,
			},
		}),
	).rejects.toThrow(/unique|constraint/i);
	await expect(
		prisma.propertyEngagement.create({
			data: {
				tenantId: ids.tenantB, propertyAssetId: ids.assetB, operationType: "SALE",
				createdByUserId: ids.user, sourceProposalId: ids.proposalA,
			},
		}),
	).rejects.toThrow(/foreign key|constraint/i);
	await expect(
		prisma.$executeRawUnsafe(
			`UPDATE property_proposals SET id = '${ids.proposalA}-updated' WHERE id = '${ids.proposalA}'`,
		),
	).rejects.toThrow(/foreign key|constraint/i);
	await expect(prisma.propertyProposal.delete({ where: { id: ids.proposalA } })).rejects.toThrow(
		/foreign key|constraint/i,
	);
	await expect(prisma.propertyEngagement.delete({ where: { id: ids.source } })).resolves.toMatchObject({
		id: ids.source,
	});
}

async function assertPlans(prisma: PrismaClient, ids: ReturnType<typeof fixture>) {
	const rows = await prisma.$queryRawUnsafe<{ indexname: string; indexdef: string }[]>(
		"SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' " +
			"AND indexname IN ('property_proposals_seller_list_idx', " +
			"'property_proposals_manager_inbox_idx')",
	);
	expect(Object.fromEntries(rows.map((row) => [row.indexname, normalized(row.indexdef)]))).toEqual({
		property_proposals_seller_list_idx:
			'CREATE INDEX property_proposals_seller_list_idx ON public.property_proposals USING btree ("tenantId", "proposedByUserId", "updatedAt" DESC, id DESC)',
		property_proposals_manager_inbox_idx:
			'CREATE INDEX property_proposals_manager_inbox_idx ON public.property_proposals USING btree ("tenantId", state, COALESCE("latestSubmittedAt", "createdAt") DESC, id DESC)',
	});
	const plan = (sql: string) => transaction(prisma, async (tx) => {
		await tx.$executeRawUnsafe("SET LOCAL enable_seqscan = off");
		return tx.$queryRawUnsafe<{ "QUERY PLAN": string }[]>(`EXPLAIN (COSTS OFF) ${sql}`);
	});
	const assertPlan = (planRows: { "QUERY PLAN": string }[], index: string) => {
		const text = planRows.map((row) => row["QUERY PLAN"]).join("\n");
		expect(text).toContain(index);
		expect(text).not.toMatch(/Incremental Sort|\bSort\b/);
	};
	assertPlan(
		await plan(
			`SELECT id FROM property_proposals WHERE "tenantId" = '${ids.tenantA}' ` +
				`AND "proposedByUserId" = '${ids.user}' ` +
				'ORDER BY "updatedAt" DESC, id DESC',
		),
		"property_proposals_seller_list_idx",
	);
	for (const predicate of ["IS NULL", "IS NOT NULL"]) {
		assertPlan(
			await plan(
				`SELECT id FROM property_proposals WHERE "tenantId" = '${ids.tenantA}' ` +
					"AND state = 'BORRADOR' " +
					`AND "latestSubmittedAt" ${predicate} ` +
					'ORDER BY COALESCE("latestSubmittedAt", "createdAt") DESC, id DESC',
			),
			"property_proposals_manager_inbox_idx",
		);
	}
}

async function populateDdlFixture(builder: PrismaClient, names: Record<string, string>) {
	await builder.$executeRawUnsafe(`CREATE TABLE ${quote(names.property_proposals)} ("id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, UNIQUE ("id", "tenantId"))`);
	await builder.$executeRawUnsafe(`CREATE TABLE ${quote(names.property_engagements)} (LIKE "property_engagements" INCLUDING DEFAULTS)`);
	await builder.$executeRawUnsafe(`INSERT INTO ${quote(names.property_proposals)} ("id", "tenantId") VALUES ('source', 'tenant')`);
	// 40k is a conservative synthetic snapshot: 39,999 null direct sources and one link.
	await builder.$executeRawUnsafe(
		`INSERT INTO ${quote(names.property_engagements)} ` +
			'("id", "tenantId", "propertyAssetId", "operationType", ' +
			'"createdByUserId", "sourceProposalId", "updatedAt") ' +
			"SELECT 'engagement-' || series, 'tenant', 'asset', 'SALE', 'user', " +
			"CASE WHEN series = 1 THEN 'source' ELSE NULL END, CURRENT_TIMESTAMP " +
			`FROM generate_series(1, ${productionShapedEngagementRows}) AS series`,
	);
	const [counts] = await builder.$queryRawUnsafe<
		{ total: bigint; nulls: bigint; links: bigint }[]
	>(
		`SELECT count(*) AS total, ` +
			'count(*) FILTER (WHERE "sourceProposalId" IS NULL) AS nulls, ' +
			'count(*) FILTER (WHERE "sourceProposalId" IS NOT NULL) AS links ' +
			`FROM ${quote(names.property_engagements)}`,
	);
	expect(counts).toEqual({ total: 40_000n, nulls: 39_999n, links: 1n });
}

async function teardownDdl(
	writer: PrismaClient, builder: PrismaClient, observer: PrismaClient,
	writerWork: Promise<unknown> | undefined, builderWork: Promise<unknown> | undefined,
	names: Record<string, string>,
) {
	const failures: unknown[] = [];
	const capture = async (work: () => Promise<unknown>) => {
		try {
			await work();
		} catch (error) {
			failures.push(error);
		}
	};
	await capture(() => writerWork ?? Promise.resolve());
	await capture(() => builderWork ?? Promise.resolve());
	await capture(() => builder.$executeRawUnsafe(`DROP TABLE IF EXISTS ${quote(names.property_engagements)} CASCADE`));
	await capture(() => builder.$executeRawUnsafe(`DROP TABLE IF EXISTS ${quote(names.property_proposals)} CASCADE`));
	await capture(() => disconnectWithDeadline(writer, "writer"));
	await capture(() => disconnectWithDeadline(builder, "builder"));
	await capture(() => disconnectWithDeadline(observer, "observer"));
	return failures;
}

describe("property proposal migration hardening", () => {
	it("enforces decision, composite-FK, source, deletion, and planner boundaries", async () => {
		const prisma = client(`proposal-hardening-${randomUUID()}`);
		const ids = fixture(randomUUID());
		await preserveFixtureAndDisconnect(prisma, ids, async () => {
			await configureClient(prisma);
			const rounds = await setupFixture(prisma, ids);
			expect(await prisma.propertyProposal.count({ where: { title: "Duplicate" } })).toBe(2);
			await assertDecisions(prisma, ids, rounds);
			await assertSourceRules(prisma, ids, rounds[0].id);
			await assertPlans(prisma, ids);
		});
	}, 20_000);

	it("measures full actual DDL under an exact bounded writer block", async () => {
		const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
		const names = {
			property_engagements: `pe_c2b_${suffix}`,
			property_proposals: `pp_c2b_${suffix}`,
			property_engagements_sourceProposalId_key: `pe_source_key_${suffix}`,
			property_engagements_sourceProposalId_tenantId_key: `pe_source_tenant_key_${suffix}`,
			property_engagements_sourceProposalId_tenantId_fkey: `pe_source_fk_${suffix}`,
		};
		const writer = client(`proposal-ddl-writer-${suffix}`);
		const builder = client(`proposal-ddl-builder-${suffix}`, statementBudgetMs);
		const observer = client(`proposal-ddl-observer-${suffix}`, observerStatementTimeoutMs);
		let writerPid: number | undefined;
		let builderPid: number | undefined;
		let releaseWriter = () => undefined;
		let writerWork: Promise<unknown> | undefined;
		let builderWork: Promise<unknown> | undefined;
		let workFailure: unknown;
		let cleanupFailures: unknown[] = [];
		try {
			[writerPid, builderPid] = await Promise.all([configureClient(writer), configureClient(builder)]);
			await configureClient(observer);
			await populateDdlFixture(builder, names);
			let signalLock!: () => void;
			const locked = new Promise<void>((resolve) => {
				signalLock = resolve;
			});
			const released = new Promise<void>((resolve) => {
				releaseWriter = resolve;
			});
			writerWork = transaction(writer, async (tx) => {
				await tx.$executeRawUnsafe(`UPDATE ${quote(names.property_engagements)} SET "sourceProposalId" = "sourceProposalId" WHERE id = 'engagement-1'`);
				signalLock();
				await released;
			});
			await waitForBarrier("writer lock acquisition", 5_000, locked);
			if (writerPid === undefined || builderPid === undefined) {
				throw new Error("writer and builder PIDs must be configured before DDL observation");
			}
			const statements = sourceDdl().map((sql) => scratchDdl(sql, names));
			const shortLockFailure = transaction(builder, async (tx) => {
				await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '250ms'");
				await tx.$executeRawUnsafe(statements[0]);
			});
			const shortBlock = await observeExactBlock(observer, builderPid, writerPid);
			expect(shortBlock.wait_event_type).toBe("Lock");
			expect(shortBlock.blockers).toContain(writerPid);
			await expect(shortLockFailure).rejects.toThrow(/lock timeout|canceling statement/i);

			const startedAt = performance.now();
			builderWork = transaction(
				builder,
				async (tx) => {
					for (const statement of statements) {
						await tx.$executeRawUnsafe(statement);
					}
				},
				fullDdlTransactionTimeoutMs,
			);
			const block = await observeExactBlock(observer, builderPid, writerPid);
			expect(block.wait_event_type).toBe("Lock");
			expect(block.blockers).toContain(writerPid);
			releaseWriter();
			await builderWork;
			const durationMs = performance.now() - startedAt;
			expect(durationMs).toBeLessThan(statementBudgetMs);
			console.info(`C2B full DDL: rows=40000 writer=${writerPid} builder=${builderPid} duration=${durationMs.toFixed(1)}ms`);
		} catch (error) {
			workFailure = error;
		} finally {
			releaseWriter();
			cleanupFailures = await teardownDdl(writer, builder, observer, writerWork, builderWork, names);
		}
		if (workFailure && cleanupFailures.length) {
			throw new AggregateError([workFailure, new AggregateError(cleanupFailures)], "DDL work and cleanup failed");
		}
		if (workFailure) throw workFailure;
		if (cleanupFailures.length) throw new AggregateError(cleanupFailures, "DDL cleanup failed");
	}, 60_000);
});
