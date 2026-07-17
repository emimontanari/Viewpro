import { describe, expect, it, vi } from "vitest";
import { PrismaMembershipActivityRepository } from "./prisma-membership-activity.repository";

/**
 * platform-user-activity-capture — RED: PrismaMembershipActivityRepository
 *
 * Spec: platform-user-activity-capture — "Invited events", "Joined events,
 *   excluding the first owner", "Deactivated events", "Strict tenant
 *   isolation", "No new writes or migrations".
 * Design D1: 3 bounded sub-queries (teamInvitation; tenantMembership
 *   role!=PRINCIPAL_MANAGER; tenantMembership DEACTIVATED + batch actor
 *   lookup), each with an unconditional top-level `where: { tenantId }`,
 *   merged/sorted/sliced internally, ids left RAW (unprefixed) — the
 *   `membership-{invited,joined,deactivated}:` prefix is applied later by
 *   `mapActivityFeedMembership` (task 2.2), not here.
 *
 * The Prisma client is a lightweight in-memory double: findMany/count
 * implementations actually filter the fixture rows by the `where` argument
 * passed in, so cross-tenant leakage would surface as a real behavioral
 * failure, not just a missed assertion.
 */

type Actor = { id: string; email: string; firstName: string };

type InvitationRow = {
	id: string;
	tenantId: string;
	email: string;
	createdAt: Date;
	invitedByUser: Actor;
};

type MembershipRow = {
	id: string;
	tenantId: string;
	role: "PRINCIPAL_MANAGER" | "MANAGER" | "AGENT";
	status: "ACTIVE" | "DEACTIVATED";
	createdAt: Date;
	deactivatedAt: Date | null;
	deactivatedByUserId: string | null;
	user: Actor;
};

function createPrismaDouble(fixtures: {
	invitations: InvitationRow[];
	memberships: MembershipRow[];
	users: Actor[];
}) {
	const teamInvitationFindMany = vi.fn(
		(args: { where: { tenantId: string }; take: number }) => {
			const rows = fixtures.invitations
				.filter((row) => row.tenantId === args.where.tenantId)
				.sort(
					(a, b) =>
						b.createdAt.getTime() - a.createdAt.getTime() ||
						b.id.localeCompare(a.id),
				)
				.slice(0, args.take);
			return Promise.resolve(rows);
		},
	);
	const teamInvitationCount = vi.fn((args: { where: { tenantId: string } }) =>
		Promise.resolve(
			fixtures.invitations.filter((row) => row.tenantId === args.where.tenantId)
				.length,
		),
	);

	function filterMemberships(where: {
		tenantId: string;
		status?: string;
	}) {
		const isDeactivatedQuery = where.status === "DEACTIVATED";
		return fixtures.memberships
			.filter((row) => row.tenantId === where.tenantId)
			.filter((row) =>
				isDeactivatedQuery
					? row.status === "DEACTIVATED" && row.deactivatedAt !== null
					: row.role !== "PRINCIPAL_MANAGER",
			);
	}

	const tenantMembershipFindMany = vi.fn(
		(args: {
			where: { tenantId: string; status?: string };
			take: number;
		}) => {
			const isDeactivatedQuery = args.where.status === "DEACTIVATED";
			const rows = filterMemberships(args.where).sort((a, b) => {
				const aTime = (isDeactivatedQuery ? a.deactivatedAt : a.createdAt)
					?.getTime() as number;
				const bTime = (isDeactivatedQuery ? b.deactivatedAt : b.createdAt)
					?.getTime() as number;
				return bTime - aTime || b.id.localeCompare(a.id);
			});
			return Promise.resolve(rows.slice(0, args.take));
		},
	);
	const tenantMembershipCount = vi.fn(
		(args: { where: { tenantId: string; status?: string } }) =>
			Promise.resolve(filterMemberships(args.where).length),
	);

	const userFindMany = vi.fn(
		(args: { where: { id: { in: string[] } } }) =>
			Promise.resolve(
				fixtures.users.filter((user) => args.where.id.in.includes(user.id)),
			),
	);

	return {
		teamInvitation: { findMany: teamInvitationFindMany, count: teamInvitationCount },
		tenantMembership: {
			findMany: tenantMembershipFindMany,
			count: tenantMembershipCount,
		},
		user: { findMany: userFindMany },
	};
}

const inviter: Actor = { id: "inviter-1", email: "inviter@example.com", firstName: "Inviter" };
const member: Actor = { id: "member-1", email: "member@example.com", firstName: "Member" };
const deactivator: Actor = { id: "actor-1", email: "actor@example.com", firstName: "Actor" };

describe("PrismaMembershipActivityRepository", () => {
	it("derives INVITED/JOINED/DEACTIVATED shapes from existing rows (no new write)", async () => {
		const prisma = createPrismaDouble({
			invitations: [
				{
					id: "invitation-1",
					tenantId: "tenant-a",
					email: "invitee@example.com",
					createdAt: new Date("2026-06-01T10:00:00.000Z"),
					invitedByUser: inviter,
				},
			],
			memberships: [
				{
					id: "membership-joined-1",
					tenantId: "tenant-a",
					role: "AGENT",
					status: "ACTIVE",
					createdAt: new Date("2026-06-02T10:00:00.000Z"),
					deactivatedAt: null,
					deactivatedByUserId: null,
					user: member,
				},
				{
					id: "membership-deactivated-1",
					tenantId: "tenant-a",
					role: "AGENT",
					status: "DEACTIVATED",
					createdAt: new Date("2026-05-01T00:00:00.000Z"),
					deactivatedAt: new Date("2026-06-03T09:00:00.000Z"),
					deactivatedByUserId: deactivator.id,
					user: member,
				},
			],
			users: [deactivator],
		});
		const repository = new PrismaMembershipActivityRepository(prisma as never);

		const result = await repository.findManyByTenant({
			tenantId: "tenant-a",
			page: 1,
			pageSize: 20,
		});

		// A membership that was later deactivated legitimately backs BOTH a
		// JOINED event (its creation) and a DEACTIVATED event (its
		// deactivation) — two distinct lifecycle events for the same
		// underlying row, not a collision (design D1's dual-event note).
		// So total = 1 invited + 2 joined (joined-1 + deactivated-1's own
		// join) + 1 deactivated = 4.
		expect(result.total).toBe(4);
		expect(result.items).toEqual([
			expect.objectContaining({
				event: "DEACTIVATED",
				id: "membership-deactivated-1",
				tenantId: "tenant-a",
				createdAt: new Date("2026-06-03T09:00:00.000Z"),
				user: member,
				deactivatedByUser: deactivator,
			}),
			expect.objectContaining({
				event: "JOINED",
				id: "membership-joined-1",
				tenantId: "tenant-a",
				createdAt: new Date("2026-06-02T10:00:00.000Z"),
				user: member,
			}),
			expect.objectContaining({
				event: "INVITED",
				id: "invitation-1",
				tenantId: "tenant-a",
				email: "invitee@example.com",
				invitedByUser: inviter,
			}),
			expect.objectContaining({
				event: "JOINED",
				id: "membership-deactivated-1",
				tenantId: "tenant-a",
				createdAt: new Date("2026-05-01T00:00:00.000Z"),
				user: member,
			}),
		]);
		// ids are RAW here — the `membership-invited:`/etc prefix is applied by
		// the mapper (mapActivityFeedMembership), not by this repository.
		expect(result.items.every((item) => !item.id.includes(":"))).toBe(true);
	});

	it("excludes PRINCIPAL_MANAGER memberships from JOINED via the query predicate", async () => {
		const prisma = createPrismaDouble({
			invitations: [],
			memberships: [
				{
					id: "first-owner",
					tenantId: "tenant-a",
					role: "PRINCIPAL_MANAGER",
					status: "ACTIVE",
					createdAt: new Date("2026-01-01T00:00:00.000Z"),
					deactivatedAt: null,
					deactivatedByUserId: null,
					user: member,
				},
				{
					id: "invited-member",
					tenantId: "tenant-a",
					role: "AGENT",
					status: "ACTIVE",
					createdAt: new Date("2026-02-01T00:00:00.000Z"),
					deactivatedAt: null,
					deactivatedByUserId: null,
					user: member,
				},
			],
			users: [],
		});
		const repository = new PrismaMembershipActivityRepository(prisma as never);

		const result = await repository.findManyByTenant({
			tenantId: "tenant-a",
			page: 1,
			pageSize: 20,
		});

		expect(result.items.map((item) => item.id)).toEqual(["invited-member"]);
		expect(result.total).toBe(1);
		expect(prisma.tenantMembership.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					tenantId: "tenant-a",
					role: { not: "PRINCIPAL_MANAGER" },
				}),
			}),
		);
	});

	it("resolves deactivatedByUserId via a batch User.findMany lookup (no relation exists)", async () => {
		const prisma = createPrismaDouble({
			invitations: [],
			memberships: [
				{
					id: "membership-deactivated-1",
					tenantId: "tenant-a",
					role: "AGENT",
					status: "DEACTIVATED",
					createdAt: new Date("2026-05-01T00:00:00.000Z"),
					deactivatedAt: new Date("2026-06-03T09:00:00.000Z"),
					deactivatedByUserId: deactivator.id,
					user: member,
				},
				{
					id: "membership-deactivated-2",
					tenantId: "tenant-a",
					role: "AGENT",
					status: "DEACTIVATED",
					createdAt: new Date("2026-04-01T00:00:00.000Z"),
					deactivatedAt: new Date("2026-06-02T09:00:00.000Z"),
					deactivatedByUserId: deactivator.id,
					user: member,
				},
			],
			users: [deactivator],
		});
		const repository = new PrismaMembershipActivityRepository(prisma as never);

		const result = await repository.findManyByTenant({
			tenantId: "tenant-a",
			page: 1,
			pageSize: 20,
		});

		// deduped: 2 deactivated rows share the same actor → a single batch call.
		expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
		expect(prisma.user.findMany).toHaveBeenCalledWith({
			where: { id: { in: [deactivator.id] } },
			select: { id: true, email: true, firstName: true },
		});
		expect(
			result.items.every(
				(item) =>
					item.event !== "DEACTIVATED" ||
					item.deactivatedByUser?.id === deactivator.id,
			),
		).toBe(true);
	});

	it("never leaks another tenant's rows, incl. an invitation to the same email in two tenants (unconditional top-level tenantId on every sub-query)", async () => {
		const prisma = createPrismaDouble({
			invitations: [
				{
					id: "invitation-a",
					tenantId: "tenant-a",
					email: "shared@example.com",
					createdAt: new Date("2026-06-01T10:00:00.000Z"),
					invitedByUser: inviter,
				},
				{
					id: "invitation-b",
					tenantId: "tenant-b",
					email: "shared@example.com",
					createdAt: new Date("2026-06-01T11:00:00.000Z"),
					invitedByUser: inviter,
				},
			],
			memberships: [
				{
					id: "membership-a",
					tenantId: "tenant-a",
					role: "AGENT",
					status: "ACTIVE",
					createdAt: new Date("2026-06-02T10:00:00.000Z"),
					deactivatedAt: null,
					deactivatedByUserId: null,
					user: member,
				},
				{
					id: "membership-b",
					tenantId: "tenant-b",
					role: "AGENT",
					status: "DEACTIVATED",
					createdAt: new Date("2026-05-01T00:00:00.000Z"),
					deactivatedAt: new Date("2026-06-03T09:00:00.000Z"),
					deactivatedByUserId: deactivator.id,
					user: member,
				},
			],
			users: [deactivator],
		});
		const repository = new PrismaMembershipActivityRepository(prisma as never);

		const result = await repository.findManyByTenant({
			tenantId: "tenant-a",
			page: 1,
			pageSize: 20,
		});

		expect(result.items.map((item) => item.id)).toEqual([
			"membership-a",
			"invitation-a",
		]);
		expect(result.items.every((item) => item.tenantId === "tenant-a")).toBe(
			true,
		);

		for (const call of prisma.teamInvitation.findMany.mock.calls) {
			expect((call[0] as { where: { tenantId: string } }).where.tenantId).toBe(
				"tenant-a",
			);
		}
		for (const call of prisma.teamInvitation.count.mock.calls) {
			expect((call[0] as { where: { tenantId: string } }).where.tenantId).toBe(
				"tenant-a",
			);
		}
		for (const call of prisma.tenantMembership.findMany.mock.calls) {
			expect((call[0] as { where: { tenantId: string } }).where.tenantId).toBe(
				"tenant-a",
			);
		}
		for (const call of prisma.tenantMembership.count.mock.calls) {
			expect((call[0] as { where: { tenantId: string } }).where.tenantId).toBe(
				"tenant-a",
			);
		}
	});

	it("performs zero writes — the double exposes only read methods, and none are ever mutated", async () => {
		const prisma = createPrismaDouble({
			invitations: [],
			memberships: [],
			users: [],
		});
		const repository = new PrismaMembershipActivityRepository(prisma as never);

		const result = await repository.findManyByTenant({
			tenantId: "tenant-a",
			page: 1,
			pageSize: 20,
		});

		expect(result).toEqual({ items: [], total: 0 });
		expect(
			Object.keys(prisma.teamInvitation).sort(),
		).toEqual(["count", "findMany"]);
		expect(
			Object.keys(prisma.tenantMembership).sort(),
		).toEqual(["count", "findMany"]);
		expect(Object.keys(prisma.user).sort()).toEqual(["findMany"]);
	});
});
