import { randomUUID } from "node:crypto";
import { PrismaClient, PropertyOperationType, PropertyType, TenantMembershipStatus, TenantRole, UserStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPropertyEngagementsRepository, setPrimaryAgentLockBarrierForTest } from "../src/property-engagements/prisma-property-engagements.repository";
type Operation = "set" | "clear" | "remove";
type Fixture = Awaited<ReturnType<typeof createFixture>>;
const applicationPrefix = `s3-primary-${randomUUID()}`;
const firstApplicationName = `${applicationPrefix}-first`;
const secondApplicationName = `${applicationPrefix}-second`;
const observerApplicationName = `${applicationPrefix}-observer`;
function client(applicationName: string) {
	const url = new URL(process.env.DATABASE_URL!); url.searchParams.set("application_name", applicationName);
	return new PrismaClient({ datasources: { db: { url: url.toString() } } });
}
const firstClient = client(firstApplicationName);
const secondClient = client(secondApplicationName);
const observerClient = client(observerApplicationName);
function oneUseBarrier(operation: Operation) {
	let arrive!: () => void; let release!: () => void; let used = false;
	const arrived = new Promise<void>((resolve) => { arrive = resolve; });
	const wait = new Promise<void>((resolve) => { release = resolve; });
	setPrimaryAgentLockBarrierForTest(async (locked) => { if (!used && locked === operation) { used = true; arrive(); await wait; } });
	return { arrived, release };
}
async function assertClientWaitsForLock(applicationName: string) {
	for (let attempt = 0; attempt < 1_000; attempt += 1) {
		const waiting = await observerClient.$queryRaw<{ wait_event_type: string | null }[]>`SELECT wait_event_type FROM pg_stat_activity WHERE application_name = ${applicationName} AND wait_event_type = 'Lock'`;
		if (waiting.some((activity) => activity.wait_event_type === "Lock")) return;
		await new Promise<void>(setImmediate);
	}
	expect.fail(`expected PostgreSQL client ${applicationName} to wait on a row lock`);
}
function run(client: PrismaClient, fixture: Fixture, operation: Operation, candidateId: string) {
	const repository = new PrismaPropertyEngagementsRepository(client as never); const scope = { tenantId: fixture.tenantId, engagementId: fixture.engagementId };
	if (operation === "set") return repository.setPrimaryAgent({ ...scope, agentId: candidateId, expectedPrimaryAgentId: fixture.primaryId });
	return operation === "clear" ? repository.clearPrimaryAgent({ ...scope, expectedPrimaryAgentId: fixture.primaryId }) : repository.removeAgent({ ...scope, agentId: candidateId });
}
describe("primary seller PostgreSQL concurrency", () => {
	beforeAll(async () => { await Promise.all([firstClient.$connect(), secondClient.$connect(), observerClient.$connect()]); }); afterAll(async () => { setPrimaryAgentLockBarrierForTest(null); await Promise.all([firstClient.$disconnect(), secondClient.$disconnect(), observerClient.$disconnect()]); });
	it.each([
		["set/set", "set", "set", null, "updated", "stateConflict", "assignment-a"], ["set/set reverse", "set", "set", null, "updated", "stateConflict", "assignment-b"],
		["set/clear", "set", "clear", "assignment-a", "updated", "stateConflict", "assignment-b"], ["clear/set", "clear", "set", "assignment-a", "updated", "stateConflict", null],
		["set/removal", "set", "remove", "assignment-a", "updated", true, null], ["removal/set", "remove", "set", "assignment-a", true, "candidateInvalid", "assignment-a"],
		["clear/removal", "clear", "remove", "assignment-a", "updated", true, null], ["removal/clear", "remove", "clear", "assignment-a", true, "stateConflict", null],
	] as const)("serializes %s with two named connections", async (_name, first, second, primary, firstStatus, secondStatus, expectedPrimary) => {
		const fixture = await createFixture(primary === "assignment-a");
		const firstCandidate = first === "set" && primary === null ? (_name.includes("reverse") ? fixture.assignmentB : fixture.assignmentA) : first === "remove" && second === "clear" ? fixture.assignmentA : fixture.assignmentB;
		const secondCandidate = second === "set" ? (_name.includes("reverse") ? fixture.assignmentA : fixture.assignmentB) : second === "remove" && first === "clear" ? fixture.assignmentA : fixture.assignmentB;
		const barrier = oneUseBarrier(first);
		let firstResult: Promise<unknown> | undefined;
		let secondResult: Promise<unknown> | undefined;
		try {
			firstResult = run(firstClient, fixture, first, firstCandidate);
			await barrier.arrived;
			secondResult = run(secondClient, fixture, second, secondCandidate);
			await assertClientWaitsForLock(secondApplicationName);
			barrier.release();
			expect(outcome(await firstResult)).toBe(firstStatus);
			expect(outcome(await secondResult)).toBe(secondStatus);
			const assignments = await assignmentsFor(fixture);
			expect(assignments.filter((assignment) => assignment.isPrimary)).toHaveLength(expectedPrimary ? 1 : 0);
			expect(assignments.find((assignment) => assignment.isPrimary)?.id ?? null).toBe(expectedPrimary === "assignment-a" ? fixture.assignmentA : expectedPrimary === "assignment-b" ? fixture.assignmentB : null);
			const removedId = first === "remove" ? firstCandidate : second === "remove" ? secondCandidate : null;
			expect(assignments).toHaveLength(removedId ? 1 : 2);
			expect(assignments.map((assignment) => assignment.id)).not.toContain(removedId);
		} finally {
			barrier.release();
			setPrimaryAgentLockBarrierForTest(null);
			await Promise.allSettled([firstResult, secondResult].filter((result): result is Promise<unknown> => Boolean(result)));
			await cleanup(fixture);
		}
	});
	it.each(["user", "membership status", "membership role"] as const)("rechecks %s invalidation in both lock orders", async (kind) => {
		const invalidation = (client: PrismaClient, fixture: Fixture) => kind === "user"
			? client.user.update({ where: { id: fixture.userB }, data: { status: UserStatus.SUSPENDED } })
			: client.tenantMembership.update({ where: { userId_tenantId: { userId: fixture.userB, tenantId: fixture.tenantId } }, data: kind === "membership status" ? { status: TenantMembershipStatus.DEACTIVATED } : { role: TenantRole.MANAGER } });
		const invalidationFirst = await createFixture(true);
		let releaseInvalidation = () => undefined; let changing: Promise<unknown> | undefined; let selection: Promise<unknown> | undefined;
		try {
			let updated!: () => void;
			const updatedWait = new Promise<void>((resolve) => { updated = resolve; });
			const releaseWait = new Promise<void>((resolve) => { releaseInvalidation = resolve; });
			changing = secondClient.$transaction(async (tx) => { await invalidation(tx as PrismaClient, invalidationFirst); updated(); await releaseWait; });
			await updatedWait; selection = run(firstClient, invalidationFirst, "set", invalidationFirst.assignmentB);
			await assertClientWaitsForLock(firstApplicationName);
			releaseInvalidation();
			await changing;
			await expect(selection).resolves.toEqual({ status: "candidateInvalid" });
			expect(await primaryId(invalidationFirst)).toBe(invalidationFirst.assignmentA);
		} finally {
			releaseInvalidation();
			await Promise.allSettled([changing, selection].filter((result): result is Promise<unknown> => Boolean(result)));
			await cleanup(invalidationFirst);
		}
		const selectionFirst = await createFixture(true);
		const barrier = oneUseBarrier("set");
		let firstSelection: Promise<unknown> | undefined; let selectedChanging: Promise<unknown> | undefined;
		try {
			firstSelection = run(firstClient, selectionFirst, "set", selectionFirst.assignmentB);
			await barrier.arrived;
			selectedChanging = invalidation(secondClient, selectionFirst).then((result) => result);
			await assertClientWaitsForLock(secondApplicationName);
			barrier.release();
			await expect(firstSelection).resolves.toMatchObject({ status: "updated" });
			await selectedChanging;
			expect(await primaryId(selectionFirst)).toBe(selectionFirst.assignmentB);
			expect(await eligiblePrimaryId(selectionFirst)).toBeNull();
		} finally {
			barrier.release();
			setPrimaryAgentLockBarrierForTest(null);
			await Promise.allSettled([firstSelection, selectedChanging].filter((result): result is Promise<unknown> => Boolean(result)));
			await cleanup(selectionFirst);
		}
	});
	it("resumes after a held user invalidation rolls back", async () => {
		const fixture = await createFixture(true); let releaseInvalidation = () => undefined;
		let invalidating: Promise<unknown> | undefined; let selection: Promise<unknown> | undefined;
		try {
			let updated!: () => void;
			const updatedWait = new Promise<void>((resolve) => { updated = resolve; });
			const releaseWait = new Promise<void>((resolve) => { releaseInvalidation = resolve; });
			invalidating = secondClient.$transaction(async (tx) => { await tx.user.update({ where: { id: fixture.userB }, data: { status: UserStatus.SUSPENDED } }); updated(); await releaseWait; throw new Error("deliberate invalidation rollback"); });
			await updatedWait; selection = run(firstClient, fixture, "set", fixture.assignmentB);
			await assertClientWaitsForLock(firstApplicationName); releaseInvalidation();
			await expect(invalidating).rejects.toThrow("deliberate invalidation rollback");
			await expect(selection).resolves.toMatchObject({ status: "updated" });
			expect(await primaryId(fixture)).toBe(fixture.assignmentB);
			expect(await eligiblePrimaryId(fixture)).toBe(fixture.assignmentB);
			expect((await assignmentsFor(fixture)).map(({ id }) => id).sort()).toEqual([fixture.assignmentA, fixture.assignmentB].sort());
		} finally {
			releaseInvalidation(); await Promise.allSettled([invalidating, selection].filter((result): result is Promise<unknown> => Boolean(result)));
			await cleanup(fixture);
		}
	});
});
async function createFixture(hasPrimary: boolean) {
	const marker = randomUUID();
	const manager = await firstClient.user.create({ data: { email: `s3-manager-${marker}@test.local`, passwordHash: "hash", firstName: "Manager" } });
	const userA = await firstClient.user.create({ data: { email: `s3-a-${marker}@test.local`, passwordHash: "hash", firstName: "Agent" } });
	const userB = await firstClient.user.create({ data: { email: `s3-b-${marker}@test.local`, passwordHash: "hash", firstName: "Agent" } });
	const tenant = await firstClient.tenant.create({ data: { name: `S3 ${marker}`, slug: `s3-${marker}` } });
	await firstClient.tenantMembership.createMany({ data: [manager, userA, userB].map((user) => ({ userId: user.id, tenantId: tenant.id, role: user.id === manager.id ? TenantRole.MANAGER : TenantRole.AGENT })) });
	const asset = await firstClient.propertyAsset.create({ data: { title: "S3", addressLine: "Test 1", city: "Test", province: "Test", propertyType: PropertyType.HOUSE, createdByUserId: manager.id } });
	const engagement = await firstClient.propertyEngagement.create({ data: { tenantId: tenant.id, propertyAssetId: asset.id, operationType: PropertyOperationType.SALE, createdByUserId: manager.id } });
	const [a, b] = await Promise.all([userA, userB].map((user, index) => firstClient.propertyAgent.create({ data: { tenantId: tenant.id, propertyEngagementId: engagement.id, agentUserId: user.id, assignedByUserId: manager.id, isPrimary: hasPrimary && index === 0 } })));
	return { tenantId: tenant.id, engagementId: engagement.id, assetId: asset.id, managerId: manager.id, userA: userA.id, userB: userB.id, assignmentA: a.id, assignmentB: b.id, primaryId: hasPrimary ? a.id : null };
}
function outcome(result: unknown) { return result && typeof result === "object" && "status" in result ? result.status : result; }
async function assignmentsFor(fixture: Fixture) { return firstClient.propertyAgent.findMany({ where: { tenantId: fixture.tenantId, propertyEngagementId: fixture.engagementId }, select: { id: true, isPrimary: true } }); }
async function primaryId(fixture: Fixture) { return (await firstClient.propertyAgent.findFirst({ where: { tenantId: fixture.tenantId, propertyEngagementId: fixture.engagementId, isPrimary: true }, select: { id: true } }))?.id ?? null; }
async function eligiblePrimaryId(fixture: Fixture) { return (await firstClient.propertyAgent.findFirst({ where: { tenantId: fixture.tenantId, propertyEngagementId: fixture.engagementId, isPrimary: true, agentUser: { status: UserStatus.ACTIVE, memberships: { some: { tenantId: fixture.tenantId, status: TenantMembershipStatus.ACTIVE, role: TenantRole.AGENT } } } }, select: { id: true } }))?.id ?? null; }
async function cleanup(fixture: Fixture) {
	await firstClient.propertyAgent.deleteMany({ where: { tenantId: fixture.tenantId } });
	await firstClient.propertyEngagement.deleteMany({ where: { tenantId: fixture.tenantId } });
	await firstClient.propertyAsset.delete({ where: { id: fixture.assetId } });
	await firstClient.tenant.delete({ where: { id: fixture.tenantId } });
	await firstClient.user.deleteMany({ where: { id: { in: [fixture.managerId, fixture.userA, fixture.userB] } } });
}
