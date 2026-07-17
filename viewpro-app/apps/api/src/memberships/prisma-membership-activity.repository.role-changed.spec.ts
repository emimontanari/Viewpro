import { describe, expect, it, vi } from "vitest";
import { PrismaMembershipActivityRepository } from "./prisma-membership-activity.repository";

/**
 * platform-role-change-activity — RED: PrismaMembershipActivityRepository —
 * 4th sub-query (MEMBER_ROLE_CHANGED)
 *
 * Spec: platform-role-change-activity — "Cross-tenant isolation for role
 *   changes", "Correct total and pagination across four sources", "Deep page
 *   stays correct".
 * Design §4: direct `prisma.analyticsEvent.findMany`, UNCONDITIONAL top-level
 *   `where: { tenantId, eventName: 'MEMBER_ROLE_CHANGED' }`, same
 *   `skip:0, take:fetchWindow` window discipline as the other 3 sub-queries,
 *   subject/actor resolved via the SAME batch `User.findMany` lookup,
 *   malformed metadata filtered out (never throws).
 *
 * This double keeps INVITED/JOINED/DEACTIVATED sources empty so the merge
 * behavior for the 4th source can be asserted in isolation, without coupling
 * to the sibling spec's sort fixtures.
 */

type Actor = { id: string; email: string; firstName: string };

type AnalyticsEventRow = {
	id: string;
	tenantId: string;
	eventName: string;
	actorUserId: string | null;
	occurredAt: Date;
	metadata: unknown;
};

function createPrismaDouble(fixtures: {
	roleChangedEvents: AnalyticsEventRow[];
	users: Actor[];
}) {
	const emptyFindMany = vi.fn(() => Promise.resolve([]));
	const emptyCount = vi.fn(() => Promise.resolve(0));

	const analyticsEventFindMany = vi.fn(
		(args: {
			where: { tenantId: string; eventName: string };
			skip?: number;
			take: number;
		}) => {
			const skip = args.skip ?? 0;
			const rows = fixtures.roleChangedEvents
				.filter(
					(row) =>
						row.tenantId === args.where.tenantId &&
						row.eventName === args.where.eventName,
				)
				.sort(
					(a, b) =>
						b.occurredAt.getTime() - a.occurredAt.getTime() ||
						b.id.localeCompare(a.id),
				)
				.slice(skip, skip + args.take);
			return Promise.resolve(rows);
		},
	);
	const analyticsEventCount = vi.fn(
		(args: { where: { tenantId: string; eventName: string } }) =>
			Promise.resolve(
				fixtures.roleChangedEvents.filter(
					(row) =>
						row.tenantId === args.where.tenantId &&
						row.eventName === args.where.eventName,
				).length,
			),
	);

	const userFindMany = vi.fn((args: { where: { id: { in: string[] } } }) =>
		Promise.resolve(
			fixtures.users.filter((user) => args.where.id.in.includes(user.id)),
		),
	);

	return {
		teamInvitation: { findMany: emptyFindMany, count: emptyCount },
		tenantMembership: { findMany: emptyFindMany, count: emptyCount },
		analyticsEvent: { findMany: analyticsEventFindMany, count: analyticsEventCount },
		user: { findMany: userFindMany },
	};
}

const member: Actor = { id: "member-1", email: "member@example.com", firstName: "Member" };
const actor: Actor = { id: "actor-1", email: "actor@example.com", firstName: "Actor" };

describe("PrismaMembershipActivityRepository — MEMBER_ROLE_CHANGED 4th source (T6)", () => {
	it("a MEMBER_ROLE_CHANGED event for tenant A appears in tenant A's feed, tenant-scoped", async () => {
		const prisma = createPrismaDouble({
			roleChangedEvents: [
				{
					id: "evt-1",
					tenantId: "tenant-a",
					eventName: "MEMBER_ROLE_CHANGED",
					actorUserId: actor.id,
					occurredAt: new Date("2026-07-10T10:00:00.000Z"),
					metadata: {
						memberUserId: member.id,
						previousRole: "MANAGER",
						newRole: "AGENT",
					},
				},
			],
			users: [member, actor],
		});
		const repository = new PrismaMembershipActivityRepository(prisma as never);

		const result = await repository.findManyByTenant({
			tenantId: "tenant-a",
			page: 1,
			pageSize: 20,
		});

		expect(result.total).toBe(1);
		expect(result.items).toEqual([
			expect.objectContaining({
				event: "ROLE_CHANGED",
				id: "evt-1",
				tenantId: "tenant-a",
				createdAt: new Date("2026-07-10T10:00:00.000Z"),
				subject: member,
				actor,
				previousRole: "MANAGER",
				newRole: "AGENT",
			}),
		]);
	});

	it("never leaks another tenant's MEMBER_ROLE_CHANGED events (unconditional top-level tenantId)", async () => {
		const prisma = createPrismaDouble({
			roleChangedEvents: [
				{
					id: "evt-a",
					tenantId: "tenant-a",
					eventName: "MEMBER_ROLE_CHANGED",
					actorUserId: actor.id,
					occurredAt: new Date("2026-07-10T10:00:00.000Z"),
					metadata: {
						memberUserId: member.id,
						previousRole: "MANAGER",
						newRole: "AGENT",
					},
				},
				{
					id: "evt-b",
					tenantId: "tenant-b",
					eventName: "MEMBER_ROLE_CHANGED",
					actorUserId: actor.id,
					occurredAt: new Date("2026-07-11T10:00:00.000Z"),
					metadata: {
						memberUserId: member.id,
						previousRole: "AGENT",
						newRole: "MANAGER",
					},
				},
			],
			users: [member, actor],
		});
		const repository = new PrismaMembershipActivityRepository(prisma as never);

		const result = await repository.findManyByTenant({
			tenantId: "tenant-a",
			page: 1,
			pageSize: 20,
		});

		expect(result.items.map((item) => item.id)).toEqual(["evt-a"]);
		expect(result.total).toBe(1);
		for (const call of prisma.analyticsEvent.findMany.mock.calls) {
			expect(
				(call[0] as { where: { tenantId: string } }).where.tenantId,
			).toBe("tenant-a");
		}
		for (const call of prisma.analyticsEvent.count.mock.calls) {
			expect(
				(call[0] as { where: { tenantId: string } }).where.tenantId,
			).toBe("tenant-a");
		}
	});

	it("holds the bounded-window pagination invariant with the 4th source included (deep page degrades to empty, never wrong items)", async () => {
		const events: AnalyticsEventRow[] = Array.from({ length: 5 }, (_, index) => ({
			id: `evt-${index}`,
			tenantId: "tenant-a",
			eventName: "MEMBER_ROLE_CHANGED",
			actorUserId: actor.id,
			occurredAt: new Date(2026, 6, 10 - index),
			metadata: {
				memberUserId: member.id,
				previousRole: "MANAGER",
				newRole: "AGENT",
			},
		}));
		const prisma = createPrismaDouble({ roleChangedEvents: events, users: [member, actor] });
		const repository = new PrismaMembershipActivityRepository(prisma as never);

		const page1 = await repository.findManyByTenant({
			tenantId: "tenant-a",
			page: 1,
			pageSize: 2,
		});
		expect(page1.total).toBe(5);
		expect(page1.items).toHaveLength(2);

		const deepPage = await repository.findManyByTenant({
			tenantId: "tenant-a",
			page: 100,
			pageSize: 2,
		});
		expect(deepPage.total).toBe(5);
		expect(deepPage.items).toEqual([]);
	});

	it("filters out a MEMBER_ROLE_CHANGED row with malformed/legacy metadata instead of throwing", async () => {
		const prisma = createPrismaDouble({
			roleChangedEvents: [
				{
					id: "evt-good",
					tenantId: "tenant-a",
					eventName: "MEMBER_ROLE_CHANGED",
					actorUserId: actor.id,
					occurredAt: new Date("2026-07-10T10:00:00.000Z"),
					metadata: {
						memberUserId: member.id,
						previousRole: "MANAGER",
						newRole: "AGENT",
					},
				},
				{
					id: "evt-malformed",
					tenantId: "tenant-a",
					eventName: "MEMBER_ROLE_CHANGED",
					actorUserId: actor.id,
					occurredAt: new Date("2026-07-09T10:00:00.000Z"),
					metadata: { unrelated: "shape" },
				},
				{
					id: "evt-null",
					tenantId: "tenant-a",
					eventName: "MEMBER_ROLE_CHANGED",
					actorUserId: actor.id,
					occurredAt: new Date("2026-07-08T10:00:00.000Z"),
					metadata: null,
				},
			],
			users: [member, actor],
		});
		const repository = new PrismaMembershipActivityRepository(prisma as never);

		await expect(
			repository.findManyByTenant({ tenantId: "tenant-a", page: 1, pageSize: 20 }),
		).resolves.not.toThrow();

		const result = await repository.findManyByTenant({
			tenantId: "tenant-a",
			page: 1,
			pageSize: 20,
		});
		expect(result.items.map((item) => item.id)).toEqual(["evt-good"]);
	});
});
