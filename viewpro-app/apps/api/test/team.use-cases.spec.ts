import {
	BadRequestException,
	ForbiddenException,
	NotFoundException,
} from "@nestjs/common";
import {
	GlobalRole,
	TenantRole,
	TenantStatus,
	UserStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "../src/permissions/permissions.constants";
import { DeactivateTeamMemberUseCase } from "../src/team/use-cases/deactivate-team-member.use-case";
import { ListTeamMembersUseCase } from "../src/team/use-cases/list-team-members.use-case";
import { UpdateTeamMemberRoleUseCase } from "../src/team/use-cases/update-team-member-role.use-case";
import type { TenantContext } from "../src/tenant-context/tenant-context.types";

const tenant: TenantContext = {
	tenantId: "tenant-1",
	tenantSlug: "tenant-one",
	tenantStatus: TenantStatus.ACTIVE,
	membershipId: "membership-current",
	role: TenantRole.PRINCIPAL_MANAGER,
	permissions: [PERMISSIONS.TEAM_VIEW, PERMISSIONS.TEAM_MANAGE],
	userStatus: UserStatus.ACTIVE,
};

const currentUser = { id: "user-current", email: "principal@example.com" };

describe("ListTeamMembersUseCase", () => {
	it("maps tenant memberships to safe team member responses including membership status metadata", async () => {
		const membershipsRepository = {
			findManyByTenantId: vi.fn().mockResolvedValue([
				buildMembership({
					id: "membership-1",
					userId: "user-1",
					role: TenantRole.MANAGER,
					status: "DEACTIVATED",
					deactivatedAt: new Date("2026-05-03T10:00:00.000Z"),
					deactivatedByUserId: "user-current",
				}),
			]),
		};

		const useCase = new ListTeamMembersUseCase(membershipsRepository as never);

		await expect(useCase.execute(tenant)).resolves.toEqual({
			items: [
				{
					membershipId: "membership-1",
					userId: "user-1",
					email: "manager@example.com",
					firstName: "Ana",
					lastName: "Gómez",
					userStatus: UserStatus.ACTIVE,
					role: TenantRole.MANAGER,
					membershipStatus: "DEACTIVATED",
					deactivatedAt: "2026-05-03T10:00:00.000Z",
					deactivatedByUserId: "user-current",
					createdAt: "2026-05-01T10:00:00.000Z",
					updatedAt: "2026-05-02T10:00:00.000Z",
				},
			],
		});

		expect(membershipsRepository.findManyByTenantId).toHaveBeenCalledWith(
			"tenant-1",
		);
	});

	it("rejects listing without TEAM_VIEW permission", async () => {
		const membershipsRepository = { findManyByTenantId: vi.fn() };
		const useCase = new ListTeamMembersUseCase(membershipsRepository as never);

		await expect(
			useCase.execute({ ...tenant, permissions: [PERMISSIONS.TENANT_VIEW] }),
		).rejects.toThrow(new ForbiddenException("Insufficient permissions"));

		expect(membershipsRepository.findManyByTenantId).not.toHaveBeenCalled();
	});
});

describe("UpdateTeamMemberRoleUseCase", () => {
	it("updates an active non-principal team member role", async () => {
		const membershipsRepository = {
			findByIdForTenant: vi
				.fn()
				.mockResolvedValue(
					buildMembership({ id: "membership-1", role: TenantRole.AGENT }),
				),
			updateRoleForTenant: vi
				.fn()
				.mockResolvedValue(
					buildMembership({ id: "membership-1", role: TenantRole.MANAGER }),
				),
		};
		const useCase = new UpdateTeamMemberRoleUseCase(
			membershipsRepository as never,
		);

		await expect(
			useCase.execute(tenant, currentUser, "membership-1", {
				role: TenantRole.MANAGER,
			}),
		).resolves.toMatchObject({
			membershipId: "membership-1",
			role: TenantRole.MANAGER,
			membershipStatus: "ACTIVE",
		});

		expect(membershipsRepository.findByIdForTenant).toHaveBeenCalledWith(
			"membership-1",
			"tenant-1",
		);
		expect(membershipsRepository.updateRoleForTenant).toHaveBeenCalledWith({
			membershipId: "membership-1",
			tenantId: "tenant-1",
			role: TenantRole.MANAGER,
			actorUserId: "user-current",
		});
	});

	it("threads the authenticated user's id through as actorUserId (actor attribution)", async () => {
		const anotherUser = { id: "user-another", email: "another@example.com" };
		const membershipsRepository = {
			findByIdForTenant: vi
				.fn()
				.mockResolvedValue(
					buildMembership({ id: "membership-1", role: TenantRole.AGENT }),
				),
			updateRoleForTenant: vi
				.fn()
				.mockResolvedValue(
					buildMembership({ id: "membership-1", role: TenantRole.MANAGER }),
				),
		};
		const useCase = new UpdateTeamMemberRoleUseCase(
			membershipsRepository as never,
		);

		await useCase.execute(tenant, anotherUser, "membership-1", {
			role: TenantRole.MANAGER,
		});

		expect(membershipsRepository.updateRoleForTenant).toHaveBeenCalledWith(
			expect.objectContaining({ actorUserId: "user-another" }),
		);
	});

	it("requires TEAM_MANAGE permission", async () => {
		const membershipsRepository = {
			findByIdForTenant: vi.fn(),
			updateRoleForTenant: vi.fn(),
		};
		const useCase = new UpdateTeamMemberRoleUseCase(
			membershipsRepository as never,
		);

		await expect(
			useCase.execute(
				{ ...tenant, permissions: [PERMISSIONS.TEAM_VIEW] },
				currentUser,
				"membership-1",
				{ role: TenantRole.AGENT },
			),
		).rejects.toThrow(new ForbiddenException("Insufficient permissions"));
		expect(membershipsRepository.findByIdForTenant).not.toHaveBeenCalled();
	});

	it("rejects principal manager role assignment defensively", async () => {
		const membershipsRepository = {
			findByIdForTenant: vi.fn(),
			updateRoleForTenant: vi.fn(),
		};
		const useCase = new UpdateTeamMemberRoleUseCase(
			membershipsRepository as never,
		);

		await expect(
			useCase.execute(tenant, currentUser, "membership-1", {
				role: TenantRole.PRINCIPAL_MANAGER,
			}),
		).rejects.toThrow(BadRequestException);
		expect(membershipsRepository.findByIdForTenant).not.toHaveBeenCalled();
	});

	it("returns not found for another tenant membership id", async () => {
		const membershipsRepository = {
			findByIdForTenant: vi.fn().mockResolvedValue(null),
			updateRoleForTenant: vi.fn(),
		};
		const useCase = new UpdateTeamMemberRoleUseCase(
			membershipsRepository as never,
		);

		await expect(
			useCase.execute(tenant, currentUser, "other-membership", {
				role: TenantRole.AGENT,
			}),
		).rejects.toThrow(NotFoundException);
		expect(membershipsRepository.updateRoleForTenant).not.toHaveBeenCalled();
	});

	it("rejects inactive and principal manager targets", async () => {
		const membershipsRepository = {
			findByIdForTenant: vi
				.fn()
				.mockResolvedValueOnce(
					buildMembership({ id: "inactive", status: "DEACTIVATED" }),
				)
				.mockResolvedValueOnce(
					buildMembership({
						id: "principal",
						role: TenantRole.PRINCIPAL_MANAGER,
					}),
				),
			updateRoleForTenant: vi.fn(),
		};
		const useCase = new UpdateTeamMemberRoleUseCase(
			membershipsRepository as never,
		);

		await expect(
			useCase.execute(tenant, currentUser, "inactive", {
				role: TenantRole.AGENT,
			}),
		).rejects.toThrow(BadRequestException);
		await expect(
			useCase.execute(tenant, currentUser, "principal", {
				role: TenantRole.AGENT,
			}),
		).rejects.toThrow(BadRequestException);
		expect(membershipsRepository.updateRoleForTenant).not.toHaveBeenCalled();
	});
});

describe("DeactivateTeamMemberUseCase", () => {
	it("deactivates an active non-principal team member", async () => {
		const membershipsRepository = {
			findByIdForTenant: vi
				.fn()
				.mockResolvedValue(
					buildMembership({ id: "membership-1", userId: "user-1" }),
				),
			deactivateForTenant: vi.fn().mockResolvedValue(
				buildMembership({
					id: "membership-1",
					userId: "user-1",
					status: "DEACTIVATED",
					deactivatedAt: new Date("2026-05-03T10:00:00.000Z"),
					deactivatedByUserId: "user-current",
				}),
			),
		};
		const useCase = new DeactivateTeamMemberUseCase(
			membershipsRepository as never,
		);

		await expect(
			useCase.execute(tenant, currentUser, "membership-1"),
		).resolves.toMatchObject({
			membershipId: "membership-1",
			membershipStatus: "DEACTIVATED",
			deactivatedAt: "2026-05-03T10:00:00.000Z",
			deactivatedByUserId: "user-current",
		});

		expect(membershipsRepository.findByIdForTenant).toHaveBeenCalledWith(
			"membership-1",
			"tenant-1",
		);
		expect(membershipsRepository.deactivateForTenant).toHaveBeenCalledWith({
			membershipId: "membership-1",
			tenantId: "tenant-1",
			actorUserId: "user-current",
		});
	});

	it("rejects self-deactivation, principal manager targets, and already inactive targets", async () => {
		const membershipsRepository = {
			findByIdForTenant: vi
				.fn()
				.mockResolvedValueOnce(
					buildMembership({ id: "self", userId: "user-current" }),
				)
				.mockResolvedValueOnce(
					buildMembership({
						id: "principal",
						role: TenantRole.PRINCIPAL_MANAGER,
					}),
				)
				.mockResolvedValueOnce(
					buildMembership({ id: "inactive", status: "DEACTIVATED" }),
				),
			deactivateForTenant: vi.fn(),
		};
		const useCase = new DeactivateTeamMemberUseCase(
			membershipsRepository as never,
		);

		await expect(useCase.execute(tenant, currentUser, "self")).rejects.toThrow(
			BadRequestException,
		);
		await expect(
			useCase.execute(tenant, currentUser, "principal"),
		).rejects.toThrow(BadRequestException);
		await expect(
			useCase.execute(tenant, currentUser, "inactive"),
		).rejects.toThrow(BadRequestException);
		expect(membershipsRepository.deactivateForTenant).not.toHaveBeenCalled();
	});

	it("returns not found for another tenant membership id", async () => {
		const membershipsRepository = {
			findByIdForTenant: vi.fn().mockResolvedValue(null),
			deactivateForTenant: vi.fn(),
		};
		const useCase = new DeactivateTeamMemberUseCase(
			membershipsRepository as never,
		);

		await expect(
			useCase.execute(tenant, currentUser, "other-membership"),
		).rejects.toThrow(NotFoundException);
		expect(membershipsRepository.deactivateForTenant).not.toHaveBeenCalled();
	});
});

function buildMembership(overrides: Record<string, unknown> = {}) {
	return {
		id: "membership-1",
		userId: "user-1",
		tenantId: "tenant-1",
		role: TenantRole.MANAGER,
		status: "ACTIVE",
		deactivatedAt: null,
		deactivatedByUserId: null,
		createdAt: new Date("2026-05-01T10:00:00.000Z"),
		updatedAt: new Date("2026-05-02T10:00:00.000Z"),
		user: {
			id: (overrides.userId as string | undefined) ?? "user-1",
			email: "manager@example.com",
			passwordHash: "secret",
			firstName: "Ana",
			lastName: "Gómez",
			status: UserStatus.ACTIVE,
			globalRole: GlobalRole.USER,
			emailVerifiedAt: null,
			createdAt: new Date("2026-04-01T10:00:00.000Z"),
			updatedAt: new Date("2026-04-02T10:00:00.000Z"),
		},
		tenant: {
			id: "tenant-1",
			name: "Tenant One",
			slug: "tenant-one",
			status: TenantStatus.ACTIVE,
			createdAt: new Date("2026-03-01T10:00:00.000Z"),
			updatedAt: new Date("2026-03-02T10:00:00.000Z"),
		},
		...overrides,
	};
}
