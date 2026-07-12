import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	GoneException,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
import {
	TeamInvitationStatus,
	TenantRole,
	TenantStatus,
	UserStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "../src/permissions/permissions.constants";
import { hashTeamInvitationToken } from "../src/team/team-invitation-token";
import { AcceptTeamInvitationUseCase } from "../src/team/use-cases/accept-team-invitation.use-case";
import { CreateTeamInvitationUseCase } from "../src/team/use-cases/create-team-invitation.use-case";
import { ListTeamInvitationsUseCase } from "../src/team/use-cases/list-team-invitations.use-case";
import { ResendTeamInvitationUseCase } from "../src/team/use-cases/resend-team-invitation.use-case";
import { RevokeTeamInvitationUseCase } from "../src/team/use-cases/revoke-team-invitation.use-case";
import { ValidateTeamInvitationUseCase } from "../src/team/use-cases/validate-team-invitation.use-case";
import type { TenantContext } from "../src/tenant-context/tenant-context.types";

const tenant: TenantContext = {
	tenantId: "tenant-1",
	tenantSlug: "tenant-one",
	tenantStatus: TenantStatus.ACTIVE,
	membershipId: "membership-1",
	role: TenantRole.PRINCIPAL_MANAGER,
	permissions: [PERMISSIONS.TEAM_VIEW, PERMISSIONS.TEAM_MANAGE],
	userStatus: UserStatus.ACTIVE,
};

const currentUser = { id: "user-1", email: "principal@example.com" };
const configService = {
	getOrThrow: vi.fn().mockReturnValue("https://app.viewpro.test"),
};
const expiresAt = new Date("2026-06-14T10:00:00.000Z");

function authUser(overrides: Record<string, unknown> = {}) {
	return {
		id: "accepted-user-1",
		email: "seller@example.com",
		passwordHash: "stored-password-hash",
		firstName: "Seller",
		lastName: null,
		status: UserStatus.ACTIVE,
		globalRole: "USER",
		emailVerifiedAt: null,
		createdAt: new Date("2026-05-31T10:00:00.000Z"),
		updatedAt: new Date("2026-05-31T10:00:00.000Z"),
		...overrides,
	};
}

function membership(overrides: Record<string, unknown> = {}) {
	return {
		id: "membership-accepted-1",
		userId: "accepted-user-1",
		tenantId: "tenant-1",
		role: TenantRole.AGENT,
		createdAt: new Date("2026-05-31T10:00:00.000Z"),
		updatedAt: new Date("2026-05-31T10:00:00.000Z"),
		tenant: {
			id: "tenant-1",
			name: "Tenant One",
			slug: "tenant-one",
			status: TenantStatus.ACTIVE,
			createdAt: new Date("2026-05-31T10:00:00.000Z"),
			updatedAt: new Date("2026-05-31T10:00:00.000Z"),
		},
		...overrides,
	};
}

function invitation(overrides: Record<string, unknown> = {}) {
	return {
		id: "invitation-1",
		tenantId: "tenant-1",
		email: "seller@example.com",
		role: TenantRole.AGENT,
		tokenHash: "token-hash",
		token: "raw-token",
		status: TeamInvitationStatus.PENDING,
		expiresAt,
		acceptedAt: null,
		revokedAt: null,
		invitedByUserId: "user-1",
		createdAt: new Date("2026-05-31T10:00:00.000Z"),
		updatedAt: new Date("2026-05-31T10:00:00.000Z"),
		...overrides,
	};
}

describe("team invitation use cases", () => {
	it("creates a manager invitation and maps the one-time invitation URL", async () => {
		const repository = {
			createPendingInvitation: vi.fn().mockResolvedValue({
				status: "created",
				invitation: invitation({
					role: TenantRole.MANAGER,
					token: "fresh token",
				}),
			}),
		};
		const useCase = new CreateTeamInvitationUseCase(
			repository as never,
			configService as never,
		);

		const result = await useCase.execute(tenant, currentUser, {
			email: "Manager@Example.com",
			role: TenantRole.MANAGER,
		});

		expect(repository.createPendingInvitation).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			email: "manager@example.com",
			role: TenantRole.MANAGER,
			invitedByUserId: "user-1",
		});
		expect(result).toEqual({
			invitationId: "invitation-1",
			email: "seller@example.com",
			role: TenantRole.MANAGER,
			status: TeamInvitationStatus.PENDING,
			expiresAt: "2026-06-14T10:00:00.000Z",
			invitationUrl: "https://app.viewpro.test/team-invitations/fresh%20token",
		});
		expect(JSON.stringify(result)).not.toContain("tokenHash");
	});

	it("creates an agent invitation", async () => {
		const repository = {
			createPendingInvitation: vi
				.fn()
				.mockResolvedValue({ status: "created", invitation: invitation() }),
		};
		const useCase = new CreateTeamInvitationUseCase(
			repository as never,
			configService as never,
		);

		await expect(
			useCase.execute(tenant, currentUser, {
				email: "seller@example.com",
				role: TenantRole.AGENT,
			}),
		).resolves.toMatchObject({ role: TenantRole.AGENT });
	});

	it("rejects create without TEAM_MANAGE", async () => {
		const repository = { createPendingInvitation: vi.fn() };
		const useCase = new CreateTeamInvitationUseCase(
			repository as never,
			configService as never,
		);

		await expect(
			useCase.execute(
				{ ...tenant, permissions: [PERMISSIONS.TEAM_VIEW] },
				currentUser,
				{
					email: "seller@example.com",
					role: TenantRole.AGENT,
				},
			),
		).rejects.toThrow(new ForbiddenException("Insufficient permissions"));
		expect(repository.createPendingInvitation).not.toHaveBeenCalled();
	});

	it("rejects unsupported principal manager invitations", async () => {
		const repository = { createPendingInvitation: vi.fn() };
		const useCase = new CreateTeamInvitationUseCase(
			repository as never,
			configService as never,
		);

		await expect(
			useCase.execute(tenant, currentUser, {
				email: "principal@example.com",
				role: TenantRole.PRINCIPAL_MANAGER as typeof TenantRole.AGENT,
			}),
		).rejects.toThrow(new BadRequestException("Unsupported invitation role"));
	});

	it("maps existing membership conflicts", async () => {
		const repository = {
			createPendingInvitation: vi
				.fn()
				.mockResolvedValue({ status: "alreadyMember" }),
		};
		const useCase = new CreateTeamInvitationUseCase(
			repository as never,
			configService as never,
		);

		await expect(
			useCase.execute(tenant, currentUser, {
				email: "member@example.com",
				role: TenantRole.AGENT,
			}),
		).rejects.toThrow(
			new ConflictException("User is already a member of this tenant"),
		);
	});

	it("lists pending invitations without exposing token secrets", async () => {
		const repository = {
			listPendingInvitations: vi.fn().mockResolvedValue([
				invitation({
					id: "invitation-1",
					email: "first@example.com",
					createdAt: new Date("2026-05-31T09:00:00.000Z"),
				}),
			]),
		};
		const useCase = new ListTeamInvitationsUseCase(repository as never);

		const result = await useCase.execute(tenant);

		expect(repository.listPendingInvitations).toHaveBeenCalledWith({
			tenantId: "tenant-1",
		});
		expect(result).toEqual({
			items: [
				{
					invitationId: "invitation-1",
					email: "first@example.com",
					role: TenantRole.AGENT,
					status: TeamInvitationStatus.PENDING,
					expiresAt: "2026-06-14T10:00:00.000Z",
					createdAt: "2026-05-31T09:00:00.000Z",
					invitedByUserId: "user-1",
				},
			],
		});
		expect(JSON.stringify(result)).not.toContain("tokenHash");
		expect(JSON.stringify(result)).not.toContain("raw-token");
		expect(JSON.stringify(result)).not.toContain("invitationUrl");
	});

	it("rejects pending invitation list without TEAM_MANAGE", async () => {
		const repository = { listPendingInvitations: vi.fn() };
		const useCase = new ListTeamInvitationsUseCase(repository as never);

		await expect(
			useCase.execute({ ...tenant, permissions: [PERMISSIONS.TEAM_VIEW] }),
		).rejects.toThrow(new ForbiddenException("Insufficient permissions"));
		expect(repository.listPendingInvitations).not.toHaveBeenCalled();
	});

	it("resends an invitation and returns a fresh one-time URL", async () => {
		const repository = {
			resendInvitation: vi.fn().mockResolvedValue({
				status: "created",
				invitation: invitation({ id: "invitation-2", token: "fresh-token" }),
			}),
		};
		const useCase = new ResendTeamInvitationUseCase(
			repository as never,
			configService as never,
		);

		await expect(
			useCase.execute(tenant, currentUser, "invitation-1"),
		).resolves.toMatchObject({
			invitationId: "invitation-2",
			invitationUrl: "https://app.viewpro.test/team-invitations/fresh-token",
		});
		expect(repository.resendInvitation).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			invitationId: "invitation-1",
			invitedByUserId: "user-1",
		});
	});

	it("maps resend not found and unavailable states", async () => {
		const repository = {
			resendInvitation: vi
				.fn()
				.mockResolvedValueOnce({ status: "notFound" })
				.mockResolvedValueOnce({ status: "notAvailable" }),
		};
		const useCase = new ResendTeamInvitationUseCase(
			repository as never,
			configService as never,
		);

		await expect(
			useCase.execute(tenant, currentUser, "missing"),
		).rejects.toThrow(new NotFoundException("Team invitation not found"));
		await expect(
			useCase.execute(tenant, currentUser, "expired"),
		).rejects.toThrow(
			new GoneException("Team invitation is no longer available"),
		);
	});

	it("rejects resend without TEAM_MANAGE", async () => {
		const repository = { resendInvitation: vi.fn() };
		const useCase = new ResendTeamInvitationUseCase(
			repository as never,
			configService as never,
		);

		await expect(
			useCase.execute(
				{ ...tenant, permissions: [PERMISSIONS.TEAM_VIEW] },
				currentUser,
				"invitation-1",
			),
		).rejects.toThrow(new ForbiddenException("Insufficient permissions"));
	});

	it("revokes an invitation without returning a raw token or token hash", async () => {
		const repository = {
			revokeInvitation: vi.fn().mockResolvedValue({
				status: "revoked",
				invitation: invitation({
					status: TeamInvitationStatus.REVOKED,
					revokedAt: new Date("2026-06-01T10:00:00.000Z"),
				}),
			}),
		};
		const useCase = new RevokeTeamInvitationUseCase(repository as never);

		const result = await useCase.execute(tenant, "invitation-1");

		expect(repository.revokeInvitation).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			invitationId: "invitation-1",
		});
		expect(result).toEqual({
			invitationId: "invitation-1",
			email: "seller@example.com",
			role: TenantRole.AGENT,
			status: TeamInvitationStatus.REVOKED,
			expiresAt: "2026-06-14T10:00:00.000Z",
			revokedAt: "2026-06-01T10:00:00.000Z",
		});
		expect(result).not.toHaveProperty("invitationUrl");
		expect(JSON.stringify(result)).not.toContain("tokenHash");
		expect(JSON.stringify(result)).not.toContain("raw-token");
	});

	it("maps revoke not found and unavailable states", async () => {
		const repository = {
			revokeInvitation: vi
				.fn()
				.mockResolvedValueOnce({ status: "notFound" })
				.mockResolvedValueOnce({ status: "notAvailable" }),
		};
		const useCase = new RevokeTeamInvitationUseCase(repository as never);

		await expect(useCase.execute(tenant, "missing")).rejects.toThrow(
			new NotFoundException("Team invitation not found"),
		);
		await expect(useCase.execute(tenant, "expired")).rejects.toThrow(
			new GoneException("Team invitation is no longer available"),
		);
	});

	it("rejects revoke without TEAM_MANAGE", async () => {
		const repository = { revokeInvitation: vi.fn() };
		const useCase = new RevokeTeamInvitationUseCase(repository as never);

		await expect(
			useCase.execute(
				{ ...tenant, permissions: [PERMISSIONS.TEAM_VIEW] },
				"invitation-1",
			),
		).rejects.toThrow(new ForbiddenException("Insufficient permissions"));
	});

	it("validates a public team invitation without exposing token secrets", async () => {
		const publicInvitation = {
			...invitation(),
			tenant: {
				id: "tenant-1",
				name: "Tenant One",
				slug: "tenant-one",
				status: TenantStatus.ACTIVE,
			},
		};
		const repository = {
			validateByTokenHash: vi.fn().mockResolvedValue({
				status: "valid",
				invitation: publicInvitation,
				emailRegistered: true,
			}),
		};
		const useCase = new ValidateTeamInvitationUseCase(repository as never);

		const result = await useCase.execute("raw-token");

		expect(repository.validateByTokenHash).toHaveBeenCalledWith({
			tokenHash: hashTeamInvitationToken("raw-token"),
			now: expect.any(Date),
		});
		expect(result).toEqual({
			email: "seller@example.com",
			role: TenantRole.AGENT,
			status: TeamInvitationStatus.PENDING,
			expiresAt: "2026-06-14T10:00:00.000Z",
			emailRegistered: true,
			tenant: {
				id: "tenant-1",
				name: "Tenant One",
				slug: "tenant-one",
				status: TenantStatus.ACTIVE,
			},
		});
		expect(JSON.stringify(result)).not.toContain("tokenHash");
		expect(JSON.stringify(result)).not.toContain("raw-token");
	});

	it("maps public team invitation validation errors", async () => {
		const repository = {
			validateByTokenHash: vi
				.fn()
				.mockResolvedValueOnce({ status: "notFound" })
				.mockResolvedValueOnce({ status: "expired" })
				.mockResolvedValueOnce({ status: "revoked" })
				.mockResolvedValueOnce({ status: "alreadyAccepted" }),
		};
		const useCase = new ValidateTeamInvitationUseCase(repository as never);

		await expect(useCase.execute("missing")).rejects.toThrow(
			new NotFoundException("Team invitation not found"),
		);
		await expect(useCase.execute("expired")).rejects.toThrow(
			new GoneException("Team invitation has expired"),
		);
		await expect(useCase.execute("revoked")).rejects.toThrow(
			new GoneException("Team invitation is no longer available"),
		);
		await expect(useCase.execute("accepted")).rejects.toThrow(
			new GoneException("Team invitation was already accepted"),
		);
	});

	it("accepts a team invitation by registering a new user", async () => {
		const acceptedUser = authUser({ firstName: "New", lastName: "Seller" });
		const deps = createAcceptUseCaseDeps({
			repository: {
				acceptForNewUser: vi
					.fn()
					.mockResolvedValue({ status: "accepted", user: acceptedUser }),
			},
			usersRepository: { findById: vi.fn().mockResolvedValue(acceptedUser) },
		});

		const result = await deps.useCase.execute("raw-token", {
			mode: "register",
			firstName: " New ",
			lastName: " Seller ",
			password: "password123",
		});

		expect(deps.passwordHasher.hash).toHaveBeenCalledWith("password123");
		expect(deps.repository.acceptForNewUser).toHaveBeenCalledWith({
			tokenHash: hashTeamInvitationToken("raw-token"),
			firstName: "New",
			lastName: "Seller",
			passwordHash: "hashed-password",
			now: expect.any(Date),
		});
		expect(result.body.user).toMatchObject({
			id: "accepted-user-1",
			email: "seller@example.com",
			firstName: "New",
		});
		expect(result.body.memberships).toHaveLength(1);
		expect(deps.refreshTokenRepository.create).toHaveBeenCalledWith({
			userId: "accepted-user-1",
			tokenHash: "refresh-token-hash",
			expiresAt: expect.any(Date),
		});
	});

	it("rejects invalid register-mode acceptance", async () => {
		const deps = createAcceptUseCaseDeps({
			repository: {
				acceptForNewUser: vi
					.fn()
					.mockResolvedValue({ status: "userAlreadyExists" }),
			},
		});

		await expect(
			deps.useCase.execute("raw-token", {
				mode: "register",
				firstName: " ",
				password: "password123",
			}),
		).rejects.toThrow(
			new BadRequestException("Team member first name is required"),
		);
		await expect(
			deps.useCase.execute("raw-token", {
				mode: "register",
				firstName: "New",
				password: "password123",
			}),
		).rejects.toThrow(
			new ConflictException("Team invitation email is already registered"),
		);
	});

	it("rejects register-mode acceptance when another user is already authenticated", async () => {
		const deps = createAcceptUseCaseDeps({
			repository: {
				validateByTokenHash: vi.fn().mockResolvedValue({
					status: "valid",
					invitation: { ...invitation(), tenant: membership().tenant },
					emailRegistered: false,
				}),
				acceptForNewUser: vi.fn(),
			},
		});

		await expect(
			deps.useCase.execute(
				"raw-token",
				{ mode: "register", firstName: "New", password: "password123" },
				{ id: "other-user", email: "other@example.com" },
			),
		).rejects.toThrow(
			new ForbiddenException("Team invitation belongs to another email"),
		);
		expect(deps.passwordHasher.hash).not.toHaveBeenCalled();
		expect(deps.repository.acceptForNewUser).not.toHaveBeenCalled();
	});

	it("accepts a team invitation by verifying an existing user's password", async () => {
		const acceptedUser = authUser();
		const publicInvitation = {
			...invitation(),
			tenant: {
				id: "tenant-1",
				name: "Tenant One",
				slug: "tenant-one",
				status: TenantStatus.ACTIVE,
			},
		};
		const deps = createAcceptUseCaseDeps({
			repository: {
				validateByTokenHash: vi.fn().mockResolvedValue({
					status: "valid",
					invitation: publicInvitation,
					emailRegistered: true,
				}),
				acceptForExistingUser: vi
					.fn()
					.mockResolvedValue({ status: "accepted", user: acceptedUser }),
			},
			usersRepository: {
				findByEmail: vi.fn().mockResolvedValue(acceptedUser),
				findById: vi.fn().mockResolvedValue(acceptedUser),
			},
		});

		await expect(
			deps.useCase.execute("raw-token", {
				mode: "login",
				password: "password123",
			}),
		).resolves.toMatchObject({
			body: { user: { email: "seller@example.com" } },
		});
		expect(deps.passwordHasher.verify).toHaveBeenCalledWith(
			"stored-password-hash",
			"password123",
		);
		expect(deps.repository.acceptForExistingUser).toHaveBeenCalledWith({
			tokenHash: hashTeamInvitationToken("raw-token"),
			userId: "accepted-user-1",
			now: expect.any(Date),
		});
	});

	it("rejects password acceptance when another user is already authenticated", async () => {
		const deps = createAcceptUseCaseDeps({
			repository: {
				validateByTokenHash: vi.fn().mockResolvedValue({
					status: "valid",
					invitation: { ...invitation(), tenant: membership().tenant },
					emailRegistered: true,
				}),
				acceptForExistingUser: vi.fn(),
			},
		});

		await expect(
			deps.useCase.execute(
				"raw-token",
				{ mode: "login", password: "password123" },
				{ id: "other-user", email: "other@example.com" },
			),
		).rejects.toThrow(
			new ForbiddenException("Team invitation belongs to another email"),
		);
		expect(deps.passwordHasher.verify).not.toHaveBeenCalled();
		expect(deps.repository.acceptForExistingUser).not.toHaveBeenCalled();
	});

	it("rejects an existing user's invalid password", async () => {
		const acceptedUser = authUser();
		const deps = createAcceptUseCaseDeps({
			repository: {
				validateByTokenHash: vi.fn().mockResolvedValue({
					status: "valid",
					invitation: { ...invitation(), tenant: membership().tenant },
					emailRegistered: true,
				}),
				acceptForExistingUser: vi.fn(),
			},
			usersRepository: { findByEmail: vi.fn().mockResolvedValue(acceptedUser) },
			passwordHasher: { verify: vi.fn().mockResolvedValue(false) },
		});

		await expect(
			deps.useCase.execute("raw-token", {
				mode: "login",
				password: "password123",
			}),
		).rejects.toThrow(new UnauthorizedException("Invalid email or password"));
		expect(deps.repository.acceptForExistingUser).not.toHaveBeenCalled();
	});

	it("accepts a team invitation with a matching current session", async () => {
		const acceptedUser = authUser();
		const deps = createAcceptUseCaseDeps({
			repository: {
				validateByTokenHash: vi.fn().mockResolvedValue({
					status: "valid",
					invitation: { ...invitation(), tenant: membership().tenant },
					emailRegistered: true,
				}),
				acceptForExistingUser: vi
					.fn()
					.mockResolvedValue({ status: "accepted", user: acceptedUser }),
			},
			usersRepository: { findById: vi.fn().mockResolvedValue(acceptedUser) },
		});

		await deps.useCase.execute(
			"raw-token",
			{ mode: "current-session" },
			{ id: "accepted-user-1", email: "SELLER@example.com" },
		);

		expect(deps.repository.acceptForExistingUser).toHaveBeenCalledWith({
			tokenHash: hashTeamInvitationToken("raw-token"),
			userId: "accepted-user-1",
			now: expect.any(Date),
		});
	});

	it("rejects current-session acceptance for missing or wrong users", async () => {
		const deps = createAcceptUseCaseDeps({
			repository: {
				validateByTokenHash: vi.fn().mockResolvedValue({
					status: "valid",
					invitation: { ...invitation(), tenant: membership().tenant },
					emailRegistered: true,
				}),
				acceptForExistingUser: vi.fn(),
			},
		});

		await expect(
			deps.useCase.execute("raw-token", { mode: "current-session" }, null),
		).rejects.toThrow(new UnauthorizedException("Authentication required"));
		await expect(
			deps.useCase.execute(
				"raw-token",
				{ mode: "current-session" },
				{ id: "other-user", email: "other@example.com" },
			),
		).rejects.toThrow(
			new ForbiddenException("Team invitation belongs to another email"),
		);
	});

	it("maps stale team invitation acceptance states", async () => {
		const deps = createAcceptUseCaseDeps({
			repository: {
				acceptForNewUser: vi
					.fn()
					.mockResolvedValueOnce({ status: "notFound" })
					.mockResolvedValueOnce({ status: "expired" })
					.mockResolvedValueOnce({ status: "revoked" })
					.mockResolvedValueOnce({ status: "alreadyAccepted" })
					.mockResolvedValueOnce({ status: "alreadyMember" })
					.mockResolvedValueOnce({ status: "emailMismatch" })
					.mockResolvedValueOnce({ status: "userNotFound" }),
			},
		});
		const dto = {
			mode: "register" as const,
			firstName: "Seller",
			password: "password123",
		};

		await expect(deps.useCase.execute("raw-token", dto)).rejects.toThrow(
			new NotFoundException("Team invitation not found"),
		);
		await expect(deps.useCase.execute("raw-token", dto)).rejects.toThrow(
			new GoneException("Team invitation has expired"),
		);
		await expect(deps.useCase.execute("raw-token", dto)).rejects.toThrow(
			new GoneException("Team invitation is no longer available"),
		);
		await expect(deps.useCase.execute("raw-token", dto)).rejects.toThrow(
			new GoneException("Team invitation was already accepted"),
		);
		await expect(deps.useCase.execute("raw-token", dto)).rejects.toThrow(
			new ConflictException("User is already a member of this tenant"),
		);
		await expect(deps.useCase.execute("raw-token", dto)).rejects.toThrow(
			new ForbiddenException("Team invitation belongs to another email"),
		);
		await expect(deps.useCase.execute("raw-token", dto)).rejects.toThrow(
			new UnauthorizedException("Authentication required"),
		);
	});
});

function createAcceptUseCaseDeps(
	overrides: {
		repository?: Record<string, unknown>;
		usersRepository?: Record<string, unknown>;
		passwordHasher?: Record<string, unknown>;
	} = {},
) {
	const repository = {
		validateByTokenHash: vi.fn(),
		acceptForNewUser: vi.fn(),
		acceptForExistingUser: vi.fn(),
		...overrides.repository,
	};
	const usersRepository = {
		findByEmail: vi.fn(),
		findById: vi.fn().mockResolvedValue(authUser()),
		...overrides.usersRepository,
	};
	const membershipsRepository = {
		findActiveManyByUserId: vi.fn().mockResolvedValue([membership()]),
	};
	const passwordHasher = {
		hash: vi.fn().mockResolvedValue("hashed-password"),
		verify: vi.fn().mockResolvedValue(true),
		...overrides.passwordHasher,
	};
	const refreshTokenRepository = { create: vi.fn().mockResolvedValue({}) };
	const tokenService = {
		signAccessToken: vi.fn().mockResolvedValue("access-token"),
		generateRefreshToken: vi.fn().mockReturnValue("refresh-token"),
		hashRefreshToken: vi.fn().mockReturnValue("refresh-token-hash"),
		getRefreshTokenExpiresAt: vi
			.fn()
			.mockReturnValue(new Date("2026-06-30T10:00:00.000Z")),
	};
	const useCase = new AcceptTeamInvitationUseCase(
		repository as never,
		usersRepository as never,
		membershipsRepository as never,
		passwordHasher as never,
		refreshTokenRepository as never,
		tokenService as never,
	);

	return {
		useCase,
		repository,
		usersRepository,
		membershipsRepository,
		passwordHasher,
		refreshTokenRepository,
		tokenService,
	};
}
