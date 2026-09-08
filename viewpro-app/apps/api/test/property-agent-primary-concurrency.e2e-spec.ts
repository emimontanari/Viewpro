import { randomUUID } from "node:crypto";
import { PrismaClient, PropertyOperationType, PropertyType, TenantMembershipStatus, TenantRole, UserStatus } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPropertyEngagementsRepository, setPrimaryAgentLockBarrierForTest } from "../src/property-engagements/prisma-property-engagements.repository";
import { runCleanupSteps } from './cleanup-steps'

type Operation = "set" | "clear" | "remove";
type Fixture = {
  tenantId: string
  engagementId: string
  assetId: string
  managerId: string
  userA: string
  userB: string
  assignmentA: string
  assignmentB: string
  primaryId: string | null
};
const applicationPrefix = `s3-primary-${randomUUID()}`;
const firstApplicationName = `${applicationPrefix}-first`;
const secondApplicationName = `${applicationPrefix}-second`;
const observerApplicationName = `${applicationPrefix}-observer`;
const timeoutMs = 8_000;
const observationDeadlineMs = 2_000;
const disconnectDeadlineMs = 5_000;
function guardedUrl(applicationName: string) {
	const url = new URL(process.env.DATABASE_URL ?? "");
	const database = decodeURIComponent(url.pathname).split("/").filter(Boolean).at(-1) ?? "";
	if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^[A-Za-z0-9][A-Za-z0-9_-]*_test(?:_w[1-9][0-9]*|_worker_[A-Za-z0-9_-]+)?$/.test(database)) throw new Error("primary concurrency requires a guarded localhost *_test DATABASE_URL");
	url.searchParams.set("application_name", applicationName);
	url.searchParams.set("connect_timeout", "3");
	url.searchParams.set("connection_limit", "1");
	url.searchParams.set("options", `-c statement_timeout=${timeoutMs} -c lock_timeout=${timeoutMs}`);
	return url.toString();
}
function client(applicationName: string) {
	return new PrismaClient({ datasources: { db: { url: guardedUrl(applicationName) } } });
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
async function waitForBarrier(arrived: Promise<void>, operation: Promise<unknown>) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		await Promise.race([
			arrived,
			operation.then(() => { throw new Error("primary operation settled before lock barrier arrival"); }, (error) => { throw new Error("primary operation rejected before lock barrier arrival", { cause: error }); }),
			new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error(`primary lock barrier was not reached within ${observationDeadlineMs}ms`)), observationDeadlineMs); }),
		]);
	} finally { if (timer) clearTimeout(timer); }
}
async function waitForInvalidationSignal(signal: Promise<void>, transaction: Promise<unknown>) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		await Promise.race([
			signal,
			transaction.then(
				() => { throw new Error("primary invalidation committed before its lock signal"); },
				(error) => { throw new Error("primary invalidation rejected before its lock signal", { cause: error }); },
			),
			new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error(`primary invalidation lock signal was not reached within ${observationDeadlineMs}ms`)), observationDeadlineMs); }),
		]);
	} finally { if (timer) clearTimeout(timer); }
}
function appendError(errors: unknown[], error: unknown) { if (error instanceof AggregateError) errors.push(...error.errors); else errors.push(error); }
async function settleAndCleanup(fixture: Partial<Fixture>, release: () => void, promises: Array<Promise<unknown> | undefined>, primaryError: unknown, expectedRejections: Promise<unknown>[] = []) {
	release();
	const errors: unknown[] = [];
	if (primaryError !== undefined) appendError(errors, primaryError);
	const activePromises = promises.filter((promise): promise is Promise<unknown> => Boolean(promise));
	const settlements = await Promise.allSettled(activePromises);
	for (const [index, settlement] of settlements.entries()) if (settlement.status === "rejected" && !expectedRejections.includes(activePromises[index]!)) appendError(errors, settlement.reason);
	try { await cleanup(fixture); } catch (error) { appendError(errors, error); }
	if (errors.length === 1) throw errors[0];
	if (errors.length > 1) throw new AggregateError(errors, "Primary concurrency race and cleanup failures");
}
async function backendPid(applicationName: string) {
	const [activity] = await observerClient.$queryRaw<{ pid: number }[]>`SELECT pid FROM pg_stat_activity WHERE application_name = ${applicationName}`;
	if (!activity) throw new Error(`missing PostgreSQL client ${applicationName}`);
	return activity.pid;
}
async function assertClientWaitsForLock(applicationName: string, winnerPid: number) {
	const deadline = performance.now() + observationDeadlineMs;
	while (performance.now() < deadline) {
		const [activity] = await observerClient.$queryRaw<{ pid: number; application_name: string; wait_event_type: string | null; blockers: number[] }[]>`SELECT pid, application_name, wait_event_type, pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE application_name = ${applicationName}`;
		if (activity?.wait_event_type === "Lock" && activity.application_name === applicationName && activity.blockers.length === 1 && activity.blockers[0] === winnerPid) return;
		await new Promise<void>(setImmediate);
	}
	expect.fail(`expected PostgreSQL client ${applicationName} to block only on winner PID ${winnerPid}`);
}
async function disconnectWithDeadline(client: PrismaClient, name: string) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		await Promise.race([
			client.$disconnect(),
			new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error(`${name} disconnect exceeded ${disconnectDeadlineMs}ms`)), disconnectDeadlineMs); }),
		]);
	} finally { if (timer) clearTimeout(timer); }
}
function run(client: PrismaClient, fixture: Fixture, operation: Operation, candidateId: string) {
	const repository = new PrismaPropertyEngagementsRepository(client as never); const scope = { tenantId: fixture.tenantId, engagementId: fixture.engagementId };
	if (operation === "set") return repository.setPrimaryAgent({ ...scope, agentId: candidateId, expectedPrimaryAgentId: fixture.primaryId });
	return operation === "clear" ? repository.clearPrimaryAgent({ ...scope, expectedPrimaryAgentId: fixture.primaryId }) : repository.removeAgent({ ...scope, agentId: candidateId });
}
describe("primary seller PostgreSQL concurrency", () => {
	beforeAll(async () => {
		await Promise.all([firstClient.$connect(), secondClient.$connect(), observerClient.$connect()]);
	});
	afterAll(async () => {
		setPrimaryAgentLockBarrierForTest(null);
		await runCleanupSteps([
			{ name: 'first client', run: () => disconnectWithDeadline(firstClient, 'first client') },
			{ name: 'second client', run: () => disconnectWithDeadline(secondClient, 'second client') },
			{ name: 'observer client', run: () => disconnectWithDeadline(observerClient, 'observer client') },
		]);
	});
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
			await waitForBarrier(barrier.arrived, firstResult);
			const winnerPid = await backendPid(firstApplicationName);
			secondResult = run(secondClient, fixture, second, secondCandidate);
			await assertClientWaitsForLock(secondApplicationName, winnerPid);
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
		let invalidationFirst: Partial<Fixture> = {}; let releaseInvalidation = () => undefined; let changing: Promise<unknown> | undefined; let selection: Promise<unknown> | undefined; let firstError: unknown;
		try {
			invalidationFirst = await createFixture(true);
			const fixture = invalidationFirst as Fixture;
			let updated!: () => void;
			const updatedWait = new Promise<void>((resolve) => { updated = resolve; });
			const releaseWait = new Promise<void>((resolve) => { releaseInvalidation = resolve; });
			changing = secondClient.$transaction(async (tx) => { await invalidation(tx as PrismaClient, fixture); updated(); await releaseWait; });
			await waitForInvalidationSignal(updatedWait, changing); const winnerPid = await backendPid(secondApplicationName); selection = run(firstClient, fixture, "set", fixture.assignmentB);
			await assertClientWaitsForLock(firstApplicationName, winnerPid);
			releaseInvalidation();
			await changing;
			await expect(selection).resolves.toEqual({ status: "candidateInvalid" });
			expect(await primaryId(fixture)).toBe(fixture.assignmentA);
		} catch (error) { firstError = error;
		} finally { await settleAndCleanup(invalidationFirst, releaseInvalidation, [changing, selection], firstError); }
		let selectionFirst: Partial<Fixture> = {}; const barrier = oneUseBarrier("set"); let firstSelection: Promise<unknown> | undefined; let selectedChanging: Promise<unknown> | undefined; let secondError: unknown;
		try {
			selectionFirst = await createFixture(true);
			const fixture = selectionFirst as Fixture;
			firstSelection = run(firstClient, fixture, "set", fixture.assignmentB);
			await waitForBarrier(barrier.arrived, firstSelection);
			const winnerPid = await backendPid(firstApplicationName);
			selectedChanging = invalidation(secondClient, fixture).then((result) => result);
			await assertClientWaitsForLock(secondApplicationName, winnerPid);
			barrier.release();
			await expect(firstSelection).resolves.toMatchObject({ status: "updated" });
			await selectedChanging;
			expect(await primaryId(fixture)).toBe(fixture.assignmentB);
			expect(await eligiblePrimaryId(fixture)).toBeNull();
		} catch (error) { secondError = error;
		} finally { setPrimaryAgentLockBarrierForTest(null); await settleAndCleanup(selectionFirst, barrier.release, [firstSelection, selectedChanging], secondError); }
	});
	it("resumes after a held user invalidation rolls back", async () => {
		let fixture: Partial<Fixture> = {}; let releaseInvalidation = () => undefined; let invalidating: Promise<unknown> | undefined; let selection: Promise<unknown> | undefined; let primaryError: unknown; let expectedRollback = false;
		try {
			fixture = await createFixture(true);
			const data = fixture as Fixture;
			let updated!: () => void;
			const updatedWait = new Promise<void>((resolve) => { updated = resolve; });
			const releaseWait = new Promise<void>((resolve) => { releaseInvalidation = resolve; });
			invalidating = secondClient.$transaction(async (tx) => { await tx.user.update({ where: { id: data.userB }, data: { status: UserStatus.SUSPENDED } }); updated(); await releaseWait; throw new Error("deliberate invalidation rollback"); });
			await waitForInvalidationSignal(updatedWait, invalidating); const winnerPid = await backendPid(secondApplicationName); selection = run(firstClient, data, "set", data.assignmentB);
			await assertClientWaitsForLock(firstApplicationName, winnerPid); releaseInvalidation();
			await expect(invalidating).rejects.toThrow("deliberate invalidation rollback");
			expectedRollback = true;
			await expect(selection).resolves.toMatchObject({ status: "updated" });
			expect(await primaryId(data)).toBe(data.assignmentB);
			expect(await eligiblePrimaryId(data)).toBe(data.assignmentB);
			expect((await assignmentsFor(data)).map(({ id }) => id).sort()).toEqual([data.assignmentA, data.assignmentB].sort());
		} catch (error) { primaryError = error;
		} finally { await settleAndCleanup(fixture, releaseInvalidation, [invalidating, selection], primaryError, expectedRollback && invalidating ? [invalidating] : []); }
	});
	it('keeps a sole ordinary assignment non-primary before any explicit operation', async () => {
		const fixture = await createFixture(false)
		try {
			await firstClient.propertyAgent.delete({ where: { id: fixture.assignmentB } })
			expect(await assignmentsFor(fixture)).toEqual([{ id: fixture.assignmentA, isPrimary: false }])
			expect(await primaryId(fixture)).toBeNull()
		} finally {
			await cleanup(fixture)
		}
	})

	it('persists explicit set A, change to B, and clear without materializing another aggregate', async () => {
		const fixture = await createFixture(false)
		const repository = new PrismaPropertyEngagementsRepository(firstClient as never)
		try {
			const counts = await canonicalRowCounts(fixture)
			await expect(repository.setPrimaryAgent({
				tenantId: fixture.tenantId, engagementId: fixture.engagementId,
				agentId: fixture.assignmentA, expectedPrimaryAgentId: null,
			})).resolves.toMatchObject({ status: 'updated' })
			expect(await primaryId(fixture)).toBe(fixture.assignmentA)
			await expect(repository.setPrimaryAgent({
				tenantId: fixture.tenantId, engagementId: fixture.engagementId,
				agentId: fixture.assignmentB, expectedPrimaryAgentId: fixture.assignmentA,
			})).resolves.toMatchObject({ status: 'updated' })
			expect(await primaryId(fixture)).toBe(fixture.assignmentB)
			await expect(repository.clearPrimaryAgent({
				tenantId: fixture.tenantId, engagementId: fixture.engagementId,
				expectedPrimaryAgentId: fixture.assignmentB,
			})).resolves.toMatchObject({ status: 'updated' })
			expect(await primaryId(fixture)).toBeNull()
			expect(await canonicalRowCounts(fixture)).toEqual(counts)
		} finally {
			await cleanup(fixture)
		}
	})
});
async function createFixture(hasPrimary: boolean): Promise<Fixture> {
  const ids: Partial<Fixture> = {}
  const marker = randomUUID()
  try {
    const manager = await firstClient.user.create({
      data: { email: `s3-manager-${marker}@test.local`, passwordHash: 'hash', firstName: 'Manager' },
    })
    ids.managerId = manager.id
    const userA = await firstClient.user.create({
      data: { email: `s3-a-${marker}@test.local`, passwordHash: 'hash', firstName: 'Agent' },
    })
    ids.userA = userA.id
    const userB = await firstClient.user.create({
      data: { email: `s3-b-${marker}@test.local`, passwordHash: 'hash', firstName: 'Agent' },
    })
    ids.userB = userB.id
    const tenant = await firstClient.tenant.create({ data: { name: `S3 ${marker}`, slug: `s3-${marker}` } })
    ids.tenantId = tenant.id
    await firstClient.tenantMembership.createMany({
      data: [manager, userA, userB].map((user) => ({
        userId: user.id, tenantId: tenant.id,
        role: user.id === manager.id ? TenantRole.MANAGER : TenantRole.AGENT,
      })),
    })
    const asset = await firstClient.propertyAsset.create({
      data: {
        title: 'S3', addressLine: 'Test 1', city: 'Test', province: 'Test',
        propertyType: PropertyType.HOUSE, createdByUserId: manager.id,
      },
    })
    ids.assetId = asset.id
    const engagement = await firstClient.propertyEngagement.create({
      data: {
        tenantId: tenant.id, propertyAssetId: asset.id,
        operationType: PropertyOperationType.SALE, createdByUserId: manager.id,
      },
    })
    ids.engagementId = engagement.id
    const assignmentA = await firstClient.propertyAgent.create({
      data: {
        tenantId: tenant.id,
        propertyEngagementId: engagement.id,
        agentUserId: userA.id,
        assignedByUserId: manager.id,
        isPrimary: hasPrimary,
      },
    })
    ids.assignmentA = assignmentA.id
    const assignmentB = await firstClient.propertyAgent.create({
      data: {
        tenantId: tenant.id,
        propertyEngagementId: engagement.id,
        agentUserId: userB.id,
        assignedByUserId: manager.id,
        isPrimary: false,
      },
    })
    ids.assignmentB = assignmentB.id
    return { ...ids, primaryId: hasPrimary ? assignmentA.id : null } as Fixture
  } catch (error) {
    try {
      await cleanup(ids)
    } catch (cleanupError) {
      const failure = new AggregateError([error, cleanupError], 'Primary fixture creation and cleanup failed')
      failure.cause = error
      throw failure
    }
    throw error
  }
}
function outcome(result: unknown) { return result && typeof result === "object" && "status" in result ? result.status : result; }
async function assignmentsFor(fixture: Fixture) { return firstClient.propertyAgent.findMany({ where: { tenantId: fixture.tenantId, propertyEngagementId: fixture.engagementId }, select: { id: true, isPrimary: true } }); }
async function primaryId(fixture: Fixture) { return (await firstClient.propertyAgent.findFirst({ where: { tenantId: fixture.tenantId, propertyEngagementId: fixture.engagementId, isPrimary: true }, select: { id: true } }))?.id ?? null; }
async function canonicalRowCounts(fixture: Fixture) {
  const [assets, engagements, proposals] = await Promise.all([
    firstClient.propertyAsset.count({ where: { id: fixture.assetId } }),
    firstClient.propertyEngagement.count({ where: { id: fixture.engagementId, tenantId: fixture.tenantId } }),
    firstClient.propertyProposal.count({ where: { tenantId: fixture.tenantId } }),
  ])
  return { assets, engagements, proposals }
}
async function eligiblePrimaryId(fixture: Fixture) { return (await firstClient.propertyAgent.findFirst({ where: { tenantId: fixture.tenantId, propertyEngagementId: fixture.engagementId, isPrimary: true, agentUser: { status: UserStatus.ACTIVE, memberships: { some: { tenantId: fixture.tenantId, status: TenantMembershipStatus.ACTIVE, role: TenantRole.AGENT } } } }, select: { id: true } }))?.id ?? null; }
async function cleanup(fixture: Partial<Fixture>) {
  const userIds = [fixture.managerId, fixture.userA, fixture.userB].filter((id): id is string => Boolean(id))
  const noIds = { id: { in: [] } }
  const tenant = fixture.tenantId ? { tenantId: fixture.tenantId } : noIds
  const tenantId = fixture.tenantId ? { id: fixture.tenantId } : noIds
  const asset = fixture.assetId ? { id: fixture.assetId } : noIds
  await runCleanupSteps([
    { name: 'agents', run: () => firstClient.propertyAgent.deleteMany({ where: tenant }) },
    { name: 'engagements', run: () => firstClient.propertyEngagement.deleteMany({ where: tenant }) },
    { name: 'orphan assets', run: () => firstClient.propertyAsset.deleteMany({ where: asset }) },
    { name: 'tenant memberships', run: () => firstClient.tenantMembership.deleteMany({ where: tenant }) },
    { name: 'tenants', run: () => firstClient.tenant.deleteMany({ where: tenantId }) },
    { name: 'users', run: () => firstClient.user.deleteMany({ where: { id: { in: userIds } } }) },
  ])
}
