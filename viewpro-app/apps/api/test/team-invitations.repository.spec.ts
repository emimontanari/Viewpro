import {
	TeamInvitationStatus,
	TenantRole,
	TenantStatus,
	UserStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { PrismaTeamInvitationsRepository } from "../src/team/prisma-team-invitations.repository";

const now = new Date("2026-05-31T10:00:00.000Z");
const expiresAt = new Date("2026-06-14T10:00:00.000Z");

function tenant(overrides: Record<string, unknown> = {}) {
	return {
		id: "tenant-1",
		name: "Tenant One",
		slug: "tenant-one",
		status: TenantStatus.ACTIVE,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function user(overrides: Record<string, unknown> = {}) {
	return {
		id: "user-1",
		email: "seller@example.com",
		passwordHash: "password-hash",
		firstName: "Seller",
		lastName: null,
		status: UserStatus.ACTIVE,
		globalRole: "USER",
		emailVerifiedAt: null,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

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

	it("lists only pending unexpired invitations for the selected tenant newest first", async () => {
		const invitations = [
			{
				id: "newer-invitation",
				email: "newer@example.com",
				role: TenantRole.AGENT,
				status: TeamInvitationStatus.PENDING,
				expiresAt: new Date("2026-06-14T10:00:00.000Z"),
				createdAt: new Date("2026-05-31T10:05:00.000Z"),
				invitedByUserId: "user-1",
			},
			{
				id: "older-invitation",
				email: "older@example.com",
				role: TenantRole.MANAGER,
				status: TeamInvitationStatus.PENDING,
				expiresAt: new Date("2026-06-14T10:00:00.000Z"),
				createdAt: new Date("2026-05-31T10:01:00.000Z"),
				invitedByUserId: "user-2",
			},
		];
		const prisma = {
			teamInvitation: { findMany: vi.fn().mockResolvedValue(invitations) },
		};
		const repository = new PrismaTeamInvitationsRepository(prisma as never);

		const result = await repository.listPendingInvitations({
			tenantId: "tenant-1",
			now,
		});

		expect(result).toEqual(invitations);
		expect(prisma.teamInvitation.findMany).toHaveBeenCalledWith({
			where: {
				tenantId: "tenant-1",
				status: TeamInvitationStatus.PENDING,
				acceptedAt: null,
				revokedAt: null,
				expiresAt: { gt: now },
			},
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				email: true,
				role: true,
				status: true,
				expiresAt: true,
				createdAt: true,
				invitedByUserId: true,
			},
		});
		expect(result.map((item) => item.id)).toEqual([
			"newer-invitation",
			"older-invitation",
		]);
		expect(JSON.stringify(result)).not.toContain("raw-token");
		expect(JSON.stringify(result)).not.toContain("tokenHash");
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
				findFirst: vi.fn().mockResolvedValue(
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

	it("validates a pending invitation token with safe tenant metadata", async () => {
		const invitation = { ...pendingInvitation(), tenant: tenant() };
		const prisma = {
			teamInvitation: { findUnique: vi.fn().mockResolvedValue(invitation) },
			user: { findUnique: vi.fn().mockResolvedValue(null) },
		};
		const repository = new PrismaTeamInvitationsRepository(prisma as never);

		await expect(
			repository.validateByTokenHash({ tokenHash: "stored-token-hash", now }),
		).resolves.toEqual({
			status: "valid",
			invitation,
			emailRegistered: false,
		});
		expect(prisma.teamInvitation.findUnique).toHaveBeenCalledWith({
			where: { tokenHash: "stored-token-hash" },
			include: {
				tenant: { select: { id: true, name: true, slug: true, status: true } },
			},
		});
	});

	it("marks validation metadata when the invited email already has a global account", async () => {
		const prisma = {
			teamInvitation: {
				findUnique: vi
					.fn()
					.mockResolvedValue({ ...pendingInvitation(), tenant: tenant() }),
			},
			user: { findUnique: vi.fn().mockResolvedValue({ id: "user-1" }) },
		};
		const repository = new PrismaTeamInvitationsRepository(prisma as never);

		await expect(
			repository.validateByTokenHash({ tokenHash: "stored-token-hash", now }),
		).resolves.toMatchObject({ status: "valid", emailRegistered: true });
	});

	it("maps invalid invitation token validation states", async () => {
		const prisma = {
			teamInvitation: {
				findUnique: vi
					.fn()
					.mockResolvedValueOnce(null)
					.mockResolvedValueOnce({
						...pendingInvitation({
							expiresAt: new Date("2026-05-30T10:00:00.000Z"),
						}),
						tenant: tenant(),
					})
					.mockResolvedValueOnce({
						...pendingInvitation({
							status: TeamInvitationStatus.REVOKED,
							revokedAt: now,
						}),
						tenant: tenant(),
					})
					.mockResolvedValueOnce({
						...pendingInvitation({
							status: TeamInvitationStatus.ACCEPTED,
							acceptedAt: now,
						}),
						tenant: tenant(),
					}),
			},
			user: { findUnique: vi.fn() },
		};
		const repository = new PrismaTeamInvitationsRepository(prisma as never);

		await expect(
			repository.validateByTokenHash({ tokenHash: "missing", now }),
		).resolves.toEqual({ status: "notFound" });
		await expect(
			repository.validateByTokenHash({ tokenHash: "expired", now }),
		).resolves.toEqual({ status: "expired" });
		await expect(
			repository.validateByTokenHash({ tokenHash: "revoked", now }),
		).resolves.toEqual({ status: "revoked" });
		await expect(
			repository.validateByTokenHash({ tokenHash: "accepted", now }),
		).resolves.toEqual({ status: "alreadyAccepted" });
	});

	it("accepts a pending invitation for a new user transactionally", async () => {
		const createdUser = user();
		const tx = {
			teamInvitation: {
				findUnique: vi.fn().mockResolvedValue(pendingInvitation()),
				updateMany: vi.fn().mockResolvedValue({ count: 1 }),
			},
			user: {
				findUnique: vi.fn().mockResolvedValue(null),
				create: vi.fn().mockResolvedValue(createdUser),
			},
			tenantMembership: { create: vi.fn().mockResolvedValue({ id: "m-1" }) },
		};
		const repository = new PrismaTeamInvitationsRepository({
			$transaction: vi.fn((callback) => callback(tx)),
		} as never);

		await expect(
			repository.acceptForNewUser({
				tokenHash: "stored-token-hash",
				firstName: "Seller",
				passwordHash: "password-hash",
				now,
			}),
		).resolves.toEqual({ status: "accepted", user: createdUser });
		expect(tx.teamInvitation.updateMany).toHaveBeenCalledWith({
			where: {
				id: "invitation-1",
				status: TeamInvitationStatus.PENDING,
				acceptedAt: null,
				revokedAt: null,
				expiresAt: { gt: now },
			},
			data: { status: TeamInvitationStatus.ACCEPTED, acceptedAt: now },
		});
		expect(tx.user.create).toHaveBeenCalledWith({
			data: {
				email: "seller@example.com",
				passwordHash: "password-hash",
				firstName: "Seller",
				lastName: undefined,
			},
		});
		expect(tx.tenantMembership.create).toHaveBeenCalledWith({
			data: {
				userId: "user-1",
				tenantId: "tenant-1",
				role: TenantRole.AGENT,
			},
		});
	});

	it("rejects new-user acceptance when the email already exists", async () => {
		const tx = {
			teamInvitation: {
				findUnique: vi.fn().mockResolvedValue(pendingInvitation()),
			},
			user: { findUnique: vi.fn().mockResolvedValue({ id: "user-1" }) },
		};
		const repository = new PrismaTeamInvitationsRepository({
			$transaction: vi.fn((callback) => callback(tx)),
		} as never);

		await expect(
			repository.acceptForNewUser({
				tokenHash: "stored-token-hash",
				firstName: "Seller",
				passwordHash: "password-hash",
				now,
			}),
		).resolves.toEqual({ status: "userAlreadyExists" });
	});

	it("accepts a pending invitation for an existing matching user", async () => {
		const existingUser = user();
		const tx = {
			teamInvitation: {
				findUnique: vi.fn().mockResolvedValue(pendingInvitation()),
				updateMany: vi.fn().mockResolvedValue({ count: 1 }),
			},
			user: { findUnique: vi.fn().mockResolvedValue(existingUser) },
			tenantMembership: {
				findUnique: vi.fn().mockResolvedValue(null),
				create: vi.fn().mockResolvedValue({ id: "membership-1" }),
			},
		};
		const repository = new PrismaTeamInvitationsRepository({
			$transaction: vi.fn((callback) => callback(tx)),
		} as never);

		await expect(
			repository.acceptForExistingUser({
				tokenHash: "stored-token-hash",
				userId: "user-1",
				now,
			}),
		).resolves.toEqual({ status: "accepted", user: existingUser });
		expect(tx.tenantMembership.create).toHaveBeenCalledWith({
			data: {
				userId: "user-1",
				tenantId: "tenant-1",
				role: TenantRole.AGENT,
			},
		});
	});

	it("enforces email ownership and same-tenant membership during existing-user acceptance", async () => {
		const tx = {
			teamInvitation: {
				findUnique: vi.fn().mockResolvedValue(pendingInvitation()),
			},
			user: {
				findUnique: vi
					.fn()
					.mockResolvedValueOnce(user({ email: "other@example.com" }))
					.mockResolvedValueOnce(user()),
			},
			tenantMembership: {
				findUnique: vi.fn().mockResolvedValue({ id: "membership-1" }),
			},
		};
		const repository = new PrismaTeamInvitationsRepository({
			$transaction: vi.fn((callback) => callback(tx)),
		} as never);

		await expect(
			repository.acceptForExistingUser({
				tokenHash: "stored-token-hash",
				userId: "other-user",
				now,
			}),
		).resolves.toEqual({ status: "emailMismatch" });
		await expect(
			repository.acceptForExistingUser({
				tokenHash: "stored-token-hash",
				userId: "user-1",
				now,
			}),
		).resolves.toEqual({ status: "alreadyMember" });
	});

	it("does not accept stale invitations", async () => {
		const tx = {
			teamInvitation: {
				findUnique: vi.fn().mockResolvedValue(
					pendingInvitation({
						status: TeamInvitationStatus.ACCEPTED,
						acceptedAt: now,
					}),
				),
			},
			user: { findUnique: vi.fn() },
			tenantMembership: { create: vi.fn() },
		};
		const repository = new PrismaTeamInvitationsRepository({
			$transaction: vi.fn((callback) => callback(tx)),
		} as never);

		await expect(
			repository.acceptForExistingUser({
				tokenHash: "stored-token-hash",
				userId: "user-1",
				now,
			}),
		).resolves.toEqual({ status: "alreadyAccepted" });
		expect(tx.tenantMembership.create).not.toHaveBeenCalled();
	});
});
