import { TeamInvitationStatus, TenantRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { PrismaTeamInvitationsRepository } from "../src/team/prisma-team-invitations.repository";

const now = new Date("2026-05-31T10:00:00.000Z");
const expiresAt = new Date("2026-06-14T10:00:00.000Z");

function pendingInvitation(overrides: Record<string, unknown> = {}) {
	return {
		id: "invitation-1",
		tenantId: "tenant-1",
		email: "seller@example.com",
		role: TenantRole.AGENT,
		tokenHash: "stored-token-hash",
		status: TeamInvitationStatus.PENDING,
		expiresAt,
		acceptedAt: null,
		revokedAt: null,
		invitedByUserId: "inviter-1",
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

describe("PrismaTeamInvitationsRepository", () => {
	it("creates a pending invitation and stores only the token hash", async () => {
		const createdInvitation = pendingInvitation({
			tokenHash: "new-token-hash",
		});
		const tx = {
			user: { findUnique: vi.fn().mockResolvedValue(null) },
			tenantMembership: { findUnique: vi.fn() },
			teamInvitation: {
				updateMany: vi.fn().mockResolvedValue({ count: 1 }),
				create: vi.fn().mockResolvedValue(createdInvitation),
			},
		};
		const transaction = vi.fn(async (callback) => callback(tx));
		const repository = new PrismaTeamInvitationsRepository({
			$transaction: transaction,
		} as never);

		const result = await repository.createPendingInvitation({
			tenantId: "tenant-1",
			email: "Seller@Example.com",
			role: TenantRole.AGENT,
			invitedByUserId: "inviter-1",
			now,
		});

		expect(result).toEqual({
			status: "created",
			invitation: expect.objectContaining({
				id: "invitation-1",
				token: expect.any(String),
				tokenHash: "new-token-hash",
			}),
		});
		expect(tx.teamInvitation.updateMany).toHaveBeenCalledWith({
			where: {
				tenantId: "tenant-1",
				email: "seller@example.com",
				status: TeamInvitationStatus.PENDING,
			},
			data: { status: TeamInvitationStatus.REVOKED, revokedAt: now },
		});
		expect(tx.teamInvitation.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				tenantId: "tenant-1",
				email: "seller@example.com",
				role: TenantRole.AGENT,
				invitedByUserId: "inviter-1",
				tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
				expiresAt,
			}),
		});
		expect(tx.teamInvitation.create.mock.calls[0][0].data).not.toHaveProperty(
			"token",
		);
	});

	it("returns alreadyMember for an existing same-tenant membership", async () => {
		const tx = {
			user: { findUnique: vi.fn().mockResolvedValue({ id: "user-1" }) },
			tenantMembership: {
				findUnique: vi.fn().mockResolvedValue({ id: "membership-1" }),
			},
			teamInvitation: { updateMany: vi.fn(), create: vi.fn() },
		};
		const repository = new PrismaTeamInvitationsRepository({
			$transaction: vi.fn((callback) => callback(tx)),
		} as never);

		await expect(
			repository.createPendingInvitation({
				tenantId: "tenant-1",
				email: "member@example.com",
				role: TenantRole.MANAGER,
				invitedByUserId: "inviter-1",
				now,
			}),
		).resolves.toEqual({ status: "alreadyMember" });

		expect(tx.tenantMembership.findUnique).toHaveBeenCalledWith({
			where: { userId_tenantId: { userId: "user-1", tenantId: "tenant-1" } },
			select: { id: true },
		});
		expect(tx.teamInvitation.create).not.toHaveBeenCalled();
	});

	it("allows an existing global user without selected-tenant membership", async () => {
		const tx = {
			user: { findUnique: vi.fn().mockResolvedValue({ id: "user-1" }) },
			tenantMembership: { findUnique: vi.fn().mockResolvedValue(null) },
			teamInvitation: {
				updateMany: vi.fn().mockResolvedValue({ count: 0 }),
				create: vi.fn().mockResolvedValue(pendingInvitation()),
			},
		};
		const repository = new PrismaTeamInvitationsRepository({
			$transaction: vi.fn((callback) => callback(tx)),
		} as never);

		const result = await repository.createPendingInvitation({
			tenantId: "tenant-1",
			email: "existing@example.com",
			role: TenantRole.AGENT,
			invitedByUserId: "inviter-1",
			now,
		});

		expect(result.status).toBe("created");
		expect(tx.teamInvitation.create).toHaveBeenCalledOnce();
	});

	it("resends by revoking the previous pending invite and creating a fresh one", async () => {
		const tx = {
			teamInvitation: {
				findFirst: vi.fn().mockResolvedValue(pendingInvitation()),
				updateMany: vi.fn().mockResolvedValue({ count: 1 }),
				create: vi
					.fn()
					.mockResolvedValue(
						pendingInvitation({ id: "invitation-2", tokenHash: "fresh-hash" }),
					),
			},
		};
		const repository = new PrismaTeamInvitationsRepository({
			$transaction: vi.fn((callback) => callback(tx)),
		} as never);

		const result = await repository.resendInvitation({
			tenantId: "tenant-1",
			invitationId: "invitation-1",
			invitedByUserId: "inviter-2",
			now,
		});

		expect(result).toEqual({
			status: "created",
			invitation: expect.objectContaining({
				id: "invitation-2",
				token: expect.any(String),
			}),
		});
		expect(tx.teamInvitation.findFirst).toHaveBeenCalledWith({
			where: { id: "invitation-1", tenantId: "tenant-1" },
		});
		expect(tx.teamInvitation.updateMany).toHaveBeenCalledWith({
			where: {
				id: "invitation-1",
				tenantId: "tenant-1",
				status: TeamInvitationStatus.PENDING,
				acceptedAt: null,
				revokedAt: null,
				expiresAt: { gt: now },
			},
			data: { status: TeamInvitationStatus.REVOKED, revokedAt: now },
		});
		expect(tx.teamInvitation.create).toHaveBeenCalledWith({
			data: expect.objectContaining({
				tenantId: "tenant-1",
				email: "seller@example.com",
				role: TenantRole.AGENT,
				invitedByUserId: "inviter-2",
			}),
		});
	});

	it("returns notFound when resending an invitation outside the tenant", async () => {
		const tx = {
			teamInvitation: { findFirst: vi.fn().mockResolvedValue(null) },
		};
		const repository = new PrismaTeamInvitationsRepository({
			$transaction: vi.fn((callback) => callback(tx)),
		} as never);

		await expect(
			repository.resendInvitation({
				tenantId: "tenant-2",
				invitationId: "invitation-1",
				invitedByUserId: "inviter-1",
				now,
			}),
		).resolves.toEqual({ status: "notFound" });
	});

	it("returns notAvailable when resending a non-pending or expired invitation", async () => {
		const tx = {
			teamInvitation: {
				findFirst: vi
					.fn()
					.mockResolvedValue(
						pendingInvitation({
							expiresAt: new Date("2026-05-30T10:00:00.000Z"),
						}),
					),
			},
		};
		const repository = new PrismaTeamInvitationsRepository({
			$transaction: vi.fn((callback) => callback(tx)),
		} as never);

		await expect(
			repository.resendInvitation({
				tenantId: "tenant-1",
				invitationId: "invitation-1",
				invitedByUserId: "inviter-1",
				now,
			}),
		).resolves.toEqual({ status: "notAvailable" });
	});

	it("does not resend when the pending invitation was changed after lookup", async () => {
		const tx = {
			teamInvitation: {
				findFirst: vi.fn().mockResolvedValue(pendingInvitation()),
				updateMany: vi.fn().mockResolvedValue({ count: 0 }),
				create: vi.fn(),
			},
		};
		const repository = new PrismaTeamInvitationsRepository({
			$transaction: vi.fn((callback) => callback(tx)),
		} as never);

		await expect(
			repository.resendInvitation({
				tenantId: "tenant-1",
				invitationId: "invitation-1",
				invitedByUserId: "inviter-1",
				now,
			}),
		).resolves.toEqual({ status: "notAvailable" });
		expect(tx.teamInvitation.create).not.toHaveBeenCalled();
	});

	it("revokes a pending invitation without returning a raw token", async () => {
		const revoked = pendingInvitation({
			status: TeamInvitationStatus.REVOKED,
			revokedAt: now,
		});
		const tx = {
			teamInvitation: {
				findFirst: vi
					.fn()
					.mockResolvedValueOnce(pendingInvitation())
					.mockResolvedValueOnce(revoked),
				updateMany: vi.fn().mockResolvedValue({ count: 1 }),
			},
		};
		const repository = new PrismaTeamInvitationsRepository({
			$transaction: vi.fn((callback) => callback(tx)),
		} as never);

		const result = await repository.revokeInvitation({
			tenantId: "tenant-1",
			invitationId: "invitation-1",
			now,
		});

		expect(result).toEqual({ status: "revoked", invitation: revoked });
		expect(
			result.status === "revoked" ? result.invitation : {},
		).not.toHaveProperty("token");
		expect(tx.teamInvitation.updateMany).toHaveBeenCalledWith({
			where: {
				id: "invitation-1",
				tenantId: "tenant-1",
				status: TeamInvitationStatus.PENDING,
				acceptedAt: null,
				revokedAt: null,
				expiresAt: { gt: now },
			},
			data: { status: TeamInvitationStatus.REVOKED, revokedAt: now },
		});
		expect(tx.teamInvitation.findFirst).toHaveBeenLastCalledWith({
			where: { id: "invitation-1", tenantId: "tenant-1" },
		});
	});

	it("returns notAvailable when revoking a stale pending invitation", async () => {
		const tx = {
			teamInvitation: {
				findFirst: vi.fn().mockResolvedValue(pendingInvitation()),
				updateMany: vi.fn().mockResolvedValue({ count: 0 }),
			},
		};
		const repository = new PrismaTeamInvitationsRepository({
			$transaction: vi.fn((callback) => callback(tx)),
		} as never);

		await expect(
			repository.revokeInvitation({
				tenantId: "tenant-1",
				invitationId: "invitation-1",
				now,
			}),
		).resolves.toEqual({ status: "notAvailable" });
	});

	it("returns notFound when revoking an invitation outside the tenant", async () => {
		const tx = {
			teamInvitation: { findFirst: vi.fn().mockResolvedValue(null) },
		};
		const repository = new PrismaTeamInvitationsRepository({
			$transaction: vi.fn((callback) => callback(tx)),
		} as never);

		await expect(
			repository.revokeInvitation({
				tenantId: "tenant-2",
				invitationId: "invitation-1",
				now,
			}),
		).resolves.toEqual({
			status: "notFound",
		});
	});
});
