import { describe, expect, it, vi } from "vitest";
import { PrismaMembershipsRepository } from "./prisma-memberships.repository";

/**
 * platform-role-change-activity — RED: PrismaMembershipsRepository.updateRoleForTenant
 *
 * Spec: platform-role-change-activity — "Atomic role-change write" (all 3
 *   scenarios).
 * Design §1: restructure into one `prisma.$transaction`, `SELECT ... FOR
 *   UPDATE` lock, read-old, no-op guard, update, `analyticsEvent.create` —
 *   mirroring `PrismaAdminTenantStatusRepository.updateTenantStatus`.
 *
 * The Prisma double keeps MUTABLE state for the locked row so the
 * "two sequential calls" test can prove the lock/read-old sequencing is
 * correct (the second call's previousRole must equal the first call's
 * newRole), not just assert on isolated mock calls.
 */

type MembershipRow = {
	id: string;
	tenantId: string;
	role: "MANAGER" | "AGENT";
	status: "ACTIVE" | "DEACTIVATED";
	userId: string;
};

function createPrismaDouble(initialRow: MembershipRow | undefined) {
	const state = { row: initialRow ? { ...initialRow } : undefined };

	const queryRaw = vi.fn(() =>
		Promise.resolve(state.row ? [{ ...state.row }] : []),
	);
	const findFirst = vi.fn(() =>
		Promise.resolve(
			state.row
				? { ...state.row, user: { id: state.row.userId }, tenant: {} }
				: null,
		),
	);
	const update = vi.fn(
		(args: { where: { id: string }; data: { role: "MANAGER" | "AGENT" } }) => {
			if (!state.row) {
				throw new Error("no row to update");
			}
			state.row = { ...state.row, role: args.data.role };
			return Promise.resolve({
				...state.row,
				user: { id: state.row.userId },
				tenant: {},
			});
		},
	);
	const analyticsEventCreate = vi.fn().mockResolvedValue({ id: "evt-1" });

	const tx = {
		$queryRaw: queryRaw,
		tenantMembership: { findFirst, update },
		analyticsEvent: { create: analyticsEventCreate },
	};

	const transaction = vi.fn(
		async (
			callback: (client: typeof tx) => Promise<unknown>,
		) => callback(tx),
	);

	return {
		prisma: { $transaction: transaction } as never,
		tx,
	};
}

const NOW = new Date("2026-07-17T12:00:00.000Z");

describe("PrismaMembershipsRepository.updateRoleForTenant — atomic write (T2)", () => {
	it("writes exactly one MEMBER_ROLE_CHANGED event with correct previousRole/newRole, in the same transaction as the UPDATE", async () => {
		const { prisma, tx } = createPrismaDouble({
			id: "membership-1",
			tenantId: "tenant-a",
			role: "MANAGER",
			status: "ACTIVE",
			userId: "user-1",
		});
		const repository = new PrismaMembershipsRepository(prisma);

		await repository.updateRoleForTenant({
			membershipId: "membership-1",
			tenantId: "tenant-a",
			role: "AGENT",
			actorUserId: "actor-1",
			now: NOW,
		});

		expect(tx.tenantMembership.update).toHaveBeenCalledTimes(1);
		expect(tx.analyticsEvent.create).toHaveBeenCalledTimes(1);
		expect(tx.analyticsEvent.create).toHaveBeenCalledWith({
			data: {
				tenantId: "tenant-a",
				actorType: "INTERNAL_USER",
				actorUserId: "actor-1",
				actorOperatorId: null,
				eventName: "MEMBER_ROLE_CHANGED",
				metadata: {
					memberUserId: "user-1",
					previousRole: "MANAGER",
					newRole: "AGENT",
				},
				occurredAt: NOW,
			},
		});
	});

	it("a transaction that fails after locking but before commit writes no event and leaves the role unchanged", async () => {
		const { prisma, tx } = createPrismaDouble({
			id: "membership-1",
			tenantId: "tenant-a",
			role: "MANAGER",
			status: "ACTIVE",
			userId: "user-1",
		});
		// Simulate a failure between the locked read and commit: the UPDATE
		// itself rejects, so analyticsEvent.create (which comes after it in the
		// same tx callback) must never run.
		tx.tenantMembership.update.mockImplementationOnce(() =>
			Promise.reject(new Error("simulated rollback")),
		);
		const repository = new PrismaMembershipsRepository(prisma);

		await expect(
			repository.updateRoleForTenant({
				membershipId: "membership-1",
				tenantId: "tenant-a",
				role: "AGENT",
				actorUserId: "actor-1",
				now: NOW,
			}),
		).rejects.toThrow("simulated rollback");

		expect(tx.analyticsEvent.create).not.toHaveBeenCalled();
	});

	it("a no-op role change (newRole === oldRole) writes nothing — no UPDATE, no event", async () => {
		const { prisma, tx } = createPrismaDouble({
			id: "membership-1",
			tenantId: "tenant-a",
			role: "MANAGER",
			status: "ACTIVE",
			userId: "user-1",
		});
		const repository = new PrismaMembershipsRepository(prisma);

		const result = await repository.updateRoleForTenant({
			membershipId: "membership-1",
			tenantId: "tenant-a",
			role: "MANAGER",
			actorUserId: "actor-1",
			now: NOW,
		});

		expect(tx.tenantMembership.update).not.toHaveBeenCalled();
		expect(tx.analyticsEvent.create).not.toHaveBeenCalled();
		expect(result).not.toBeNull();
	});

	it("two sequential role changes: the second call's previousRole equals the first call's newRole (lock prevents a stale read)", async () => {
		const { prisma, tx } = createPrismaDouble({
			id: "membership-1",
			tenantId: "tenant-a",
			role: "MANAGER",
			status: "ACTIVE",
			userId: "user-1",
		});
		const repository = new PrismaMembershipsRepository(prisma);

		await repository.updateRoleForTenant({
			membershipId: "membership-1",
			tenantId: "tenant-a",
			role: "AGENT",
			actorUserId: "actor-1",
			now: NOW,
		});
		await repository.updateRoleForTenant({
			membershipId: "membership-1",
			tenantId: "tenant-a",
			role: "MANAGER",
			actorUserId: "actor-1",
			now: NOW,
		});

		expect(tx.analyticsEvent.create).toHaveBeenCalledTimes(2);
		const firstCallMetadata = tx.analyticsEvent.create.mock.calls[0]![0].data
			.metadata as { previousRole: string; newRole: string };
		const secondCallMetadata = tx.analyticsEvent.create.mock.calls[1]![0].data
			.metadata as { previousRole: string; newRole: string };

		expect(firstCallMetadata).toEqual({
			memberUserId: "user-1",
			previousRole: "MANAGER",
			newRole: "AGENT",
		});
		expect(secondCallMetadata).toEqual({
			memberUserId: "user-1",
			previousRole: "AGENT",
			newRole: "MANAGER",
		});
	});
});
