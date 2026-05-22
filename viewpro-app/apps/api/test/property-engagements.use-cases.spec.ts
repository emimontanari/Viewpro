import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	NotFoundException,
} from "@nestjs/common";
import {
	GlobalRole,
	PropertyEngagementStatus,
	PropertyOperationType,
	PropertyType,
	TenantRole,
	TenantStatus,
	UserStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { PERMISSIONS } from "../src/permissions/permissions.constants";
import { AssignPropertyAgentUseCase } from "../src/property-engagements/use-cases/assign-property-agent.use-case";
import { ArchivePropertyEngagementUseCase } from "../src/property-engagements/use-cases/archive-property-engagement.use-case";
import { CreatePropertyEngagementUseCase } from "../src/property-engagements/use-cases/create-property-engagement.use-case";
import { GetPropertyEngagementUseCase } from "../src/property-engagements/use-cases/get-property-engagement.use-case";
import { ListAssignablePropertyAgentsUseCase } from "../src/property-engagements/use-cases/list-assignable-property-agents.use-case";
import { ListPropertyEngagementsUseCase } from "../src/property-engagements/use-cases/list-property-engagements.use-case";
import { RemovePropertyAgentUseCase } from "../src/property-engagements/use-cases/remove-property-agent.use-case";
import { RestorePropertyEngagementUseCase } from "../src/property-engagements/use-cases/restore-property-engagement.use-case";
import { SetPropertyImagePrimaryUseCase } from "../src/property-engagements/use-cases/set-property-image-primary.use-case";
import { UpdatePropertyEngagementUseCase } from "../src/property-engagements/use-cases/update-property-engagement.use-case";
import {
	mapPropertyEngagement,
	mapPropertyImage,
} from "../src/property-engagements/responses/property-engagement.response";
import type { TenantContext } from "../src/tenant-context/tenant-context.types";

const tenant: TenantContext = {
	tenantId: "tenant-1",
	tenantSlug: "tenant-one",
	tenantStatus: TenantStatus.ACTIVE,
	membershipId: "membership-1",
	role: TenantRole.PRINCIPAL_MANAGER,
	permissions: [
		PERMISSIONS.ENGAGEMENTS_VIEW_ALL,
		PERMISSIONS.ENGAGEMENTS_CREATE,
	],
	userStatus: UserStatus.ACTIVE,
};

const currentUser = { id: "user-1", email: "user@example.com" };

const propertyImage = {
	id: "image-1",
	propertyAssetId: "asset-1",
	uploadedByUserId: "user-1",
	storageKey: "tenant-1/asset-1/image-1.png",
	originalFilename: "front.png",
	mimeType: "image/png",
	sizeBytes: 1024,
	isPrimary: true,
	createdAt: new Date("2026-01-03T00:00:00.000Z"),
	updatedAt: new Date("2026-01-04T00:00:00.000Z"),
};

const engagement = {
	id: "engagement-1",
	tenantId: "tenant-1",
	propertyAssetId: "asset-1",
	operationType: PropertyOperationType.RENT,
	status: PropertyEngagementStatus.CAPTURE,
	publishedPriceCents: 25000000,
	currency: "ARS",
	createdByUserId: "user-1",
	archivedAt: null,
	archivedByUserId: null,
	archiveReason: null,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	updatedAt: new Date("2026-01-02T00:00:00.000Z"),
	propertyAsset: {
		id: "asset-1",
		title: "Downtown apartment",
		addressLine: "Av. Siempre Viva 123",
		city: "Buenos Aires",
		province: "CABA",
		propertyType: PropertyType.APARTMENT,
		totalAreaSqm: 72,
		coveredAreaSqm: 64,
		rooms: 3,
		bedrooms: 2,
		bathrooms: 1,
		garages: 1,
		ageYears: 8,
		orientation: "NE",
		ownerName: "Owner Example",
		ownerEmail: "owner@example.com",
		images: [],
		createdByUserId: "user-1",
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-02T00:00:00.000Z"),
	},
	agents: [
		{
			id: "agent-assignment-1",
			tenantId: "tenant-1",
			propertyEngagementId: "engagement-1",
			agentUserId: "agent-1",
			assignedByUserId: "user-1",
			assignedAt: new Date("2026-01-03T00:00:00.000Z"),
			agentUser: {
				id: "agent-1",
				email: "agent@example.com",
				passwordHash: "secret-hash",
				firstName: "Agent",
				lastName: "Example",
				globalRole: GlobalRole.USER,
				status: UserStatus.ACTIVE,
				emailVerifiedAt: null,
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				updatedAt: new Date("2026-01-02T00:00:00.000Z"),
			},
		},
	],
	createdBy: {
		id: "user-1",
		email: "creator@example.com",
		passwordHash: "creator-secret-hash",
		firstName: "Creator",
		lastName: "Example",
		globalRole: GlobalRole.USER,
		status: UserStatus.ACTIVE,
		emailVerifiedAt: null,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-02T00:00:00.000Z"),
	},
};

describe("Property engagement response mapper", () => {
	it("maps engagement details to safe response fields only", () => {
		expect(mapPropertyEngagement(engagement)).toEqual({
			id: "engagement-1",
			tenantId: "tenant-1",
			operationType: PropertyOperationType.RENT,
			status: PropertyEngagementStatus.CAPTURE,
			publishedPriceCents: 25000000,
			currency: "ARS",
			archivedAt: null,
			archivedByUserId: null,
			archiveReason: null,
			property: {
				id: "asset-1",
				title: "Downtown apartment",
				addressLine: "Av. Siempre Viva 123",
				city: "Buenos Aires",
				province: "CABA",
				propertyType: PropertyType.APARTMENT,
				totalAreaSqm: 72,
				coveredAreaSqm: 64,
				rooms: 3,
				bedrooms: 2,
				bathrooms: 1,
				garages: 1,
				ageYears: 8,
				orientation: "NE",
				ownerName: "Owner Example",
				ownerEmail: "owner@example.com",
				images: [],
				primaryImage: null,
			},
			agents: [
				{
					id: "agent-assignment-1",
					userId: "agent-1",
					email: "agent@example.com",
					firstName: "Agent",
				},
			],
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-02T00:00:00.000Z",
		});
	});
});

describe("Property engagement use cases", () => {
	it("creates a property asset and engagement for the current tenant and user", async () => {
		const repository = {
			createWithAsset: vi.fn().mockResolvedValue(engagement),
		};
		const useCase = new CreatePropertyEngagementUseCase(repository as never);

		const result = await useCase.execute(tenant, currentUser, {
			title: "Downtown apartment",
			addressLine: "Av. Siempre Viva 123",
			city: "Buenos Aires",
			province: "CABA",
			propertyType: PropertyType.APARTMENT,
			ownerName: "Owner Example",
			ownerEmail: "owner@example.com",
			totalAreaSqm: 72,
			coveredAreaSqm: 64,
			rooms: 3,
			bedrooms: 2,
			bathrooms: 1,
			garages: 1,
			ageYears: 8,
			orientation: "NE",
			operationType: PropertyOperationType.RENT,
			publishedPriceCents: 25000000,
			currency: "ARS",
		});

		expect(result.id).toBe("engagement-1");
		expect(repository.createWithAsset).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			createdByUserId: "user-1",
			propertyAsset: expect.objectContaining({
				title: "Downtown apartment",
				totalAreaSqm: 72,
				coveredAreaSqm: 64,
				rooms: 3,
				bedrooms: 2,
				bathrooms: 1,
				garages: 1,
				ageYears: 8,
				orientation: "NE",
				createdBy: { connect: { id: "user-1" } },
			}),
			engagement: {
				operationType: PropertyOperationType.RENT,
				publishedPriceCents: 25000000,
				currency: "ARS",
			},
		});
	});

	it("updates property asset and engagement fields for the current tenant", async () => {
		const updatedEngagement = {
			...engagement,
			operationType: PropertyOperationType.SALE,
			publishedPriceCents: 30000000,
			currency: "USD",
			propertyAsset: {
				...engagement.propertyAsset,
				title: "Updated house",
				addressLine: "Updated Street 456",
				propertyType: PropertyType.HOUSE,
				totalAreaSqm: 120,
				coveredAreaSqm: null,
				bedrooms: 3,
				ownerName: null,
			},
		};
		const repository = {
			updateForTenant: vi.fn().mockResolvedValue(updatedEngagement),
		};
		const useCase = new UpdatePropertyEngagementUseCase(repository as never);

		const result = await useCase.execute(tenant, currentUser, "engagement-1", {
			title: "Updated house",
			addressLine: "Updated Street 456",
			propertyType: PropertyType.HOUSE,
			totalAreaSqm: 120,
			coveredAreaSqm: null,
			bedrooms: 3,
			ownerName: null,
			operationType: PropertyOperationType.SALE,
			publishedPriceCents: 30000000,
			currency: "USD",
		});

		expect(result.property.title).toBe("Updated house");
		expect(result.operationType).toBe(PropertyOperationType.SALE);
		expect(repository.updateForTenant).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			engagementId: "engagement-1",
			userId: "user-1",
			canViewAll: true,
			propertyAsset: expect.objectContaining({
				title: "Updated house",
				addressLine: "Updated Street 456",
				propertyType: PropertyType.HOUSE,
				totalAreaSqm: 120,
				coveredAreaSqm: null,
				bedrooms: 3,
				ownerName: null,
			}),
			engagement: {
				operationType: PropertyOperationType.SALE,
				publishedPriceCents: 30000000,
				currency: "USD",
			},
		});
	});

	it("rejects property updates without write permission", async () => {
		const repository = { updateForTenant: vi.fn() };
		const useCase = new UpdatePropertyEngagementUseCase(repository as never);

		await expect(
			useCase.execute(
				{ ...tenant, permissions: [PERMISSIONS.ENGAGEMENTS_VIEW_ALL] },
				currentUser,
				"engagement-1",
				{ title: "Forbidden update" },
			),
		).rejects.toThrow(new ForbiddenException("Insufficient permissions"));
		expect(repository.updateForTenant).not.toHaveBeenCalled();
	});

	it("returns not found when updating another tenant or missing engagement", async () => {
		const repository = { updateForTenant: vi.fn().mockResolvedValue(null) };
		const useCase = new UpdatePropertyEngagementUseCase(repository as never);

		await expect(
			useCase.execute(tenant, currentUser, "missing-engagement", {
				title: "Missing update",
			}),
		).rejects.toThrow(new NotFoundException("Property engagement not found"));
	});

	it("archives a property engagement for the current tenant and user", async () => {
		const archivedEngagement = {
			...engagement,
			archivedAt: new Date("2026-01-05T00:00:00.000Z"),
			archivedByUserId: "user-1",
			archiveReason: "Owner requested pause",
		};
		const repository = {
			archiveForTenant: vi
				.fn()
				.mockResolvedValue({
					status: "archived",
					engagement: archivedEngagement,
				}),
		};
		const useCase = new ArchivePropertyEngagementUseCase(repository as never);

		const result = await useCase.execute(tenant, currentUser, "engagement-1", {
			reason: "Owner requested pause",
		});

		expect(result.id).toBe("engagement-1");
		expect(repository.archiveForTenant).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			engagementId: "engagement-1",
			userId: "user-1",
			canViewAll: true,
			archivedByUserId: "user-1",
			archiveReason: "Owner requested pause",
		});
	});

	it("rejects archive actions without write permission", async () => {
		const repository = { archiveForTenant: vi.fn() };
		const useCase = new ArchivePropertyEngagementUseCase(repository as never);

		await expect(
			useCase.execute(
				{ ...tenant, permissions: [PERMISSIONS.ENGAGEMENTS_VIEW_ALL] },
				currentUser,
				"engagement-1",
				{},
			),
		).rejects.toThrow(new ForbiddenException("Insufficient permissions"));
		expect(repository.archiveForTenant).not.toHaveBeenCalled();
	});

	it("rejects archive actions when the engagement is already archived", async () => {
		const repository = {
			archiveForTenant: vi
				.fn()
				.mockResolvedValue({ status: "alreadyArchived" }),
		};
		const useCase = new ArchivePropertyEngagementUseCase(repository as never);

		await expect(
			useCase.execute(tenant, currentUser, "engagement-1", {}),
		).rejects.toThrow(
			new BadRequestException("Property engagement is already archived"),
		);
	});

	it("returns not found when archiving another tenant or missing engagement", async () => {
		const repository = { archiveForTenant: vi.fn().mockResolvedValue(null) };
		const useCase = new ArchivePropertyEngagementUseCase(repository as never);

		await expect(
			useCase.execute(tenant, currentUser, "missing-engagement", {}),
		).rejects.toThrow(new NotFoundException("Property engagement not found"));
	});

	it("restores a property engagement for the current tenant and user", async () => {
		const restoredEngagement = {
			...engagement,
			archivedAt: null,
			archivedByUserId: null,
			archiveReason: null,
		};
		const repository = {
			restoreForTenant: vi
				.fn()
				.mockResolvedValue({
					status: "restored",
					engagement: restoredEngagement,
				}),
		};
		const useCase = new RestorePropertyEngagementUseCase(repository as never);

		const result = await useCase.execute(tenant, currentUser, "engagement-1");

		expect(result.id).toBe("engagement-1");
		expect(repository.restoreForTenant).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			engagementId: "engagement-1",
			userId: "user-1",
			canViewAll: true,
		});
	});

	it("rejects restore actions without write permission", async () => {
		const repository = { restoreForTenant: vi.fn() };
		const useCase = new RestorePropertyEngagementUseCase(repository as never);

		await expect(
			useCase.execute(
				{ ...tenant, permissions: [PERMISSIONS.ENGAGEMENTS_VIEW_ALL] },
				currentUser,
				"engagement-1",
			),
		).rejects.toThrow(new ForbiddenException("Insufficient permissions"));
		expect(repository.restoreForTenant).not.toHaveBeenCalled();
	});

	it("rejects restore actions when the engagement is not archived", async () => {
		const repository = {
			restoreForTenant: vi.fn().mockResolvedValue({ status: "notArchived" }),
		};
		const useCase = new RestorePropertyEngagementUseCase(repository as never);

		await expect(
			useCase.execute(tenant, currentUser, "engagement-1"),
		).rejects.toThrow(
			new BadRequestException("Property engagement is not archived"),
		);
	});

	it("returns not found when restoring another tenant or missing engagement", async () => {
		const repository = { restoreForTenant: vi.fn().mockResolvedValue(null) };
		const useCase = new RestorePropertyEngagementUseCase(repository as never);

		await expect(
			useCase.execute(tenant, currentUser, "missing-engagement"),
		).rejects.toThrow(new NotFoundException("Property engagement not found"));
	});

	it("lists all tenant engagements when view-all permission is present", async () => {
		const repository = {
			findMany: vi.fn().mockResolvedValue({ items: [engagement], total: 1 }),
		};
		const useCase = new ListPropertyEngagementsUseCase(repository as never);

		const result = await useCase.execute(tenant, currentUser, {
			page: 2,
			pageSize: 10,
			archived: "active",
		});

		expect(result.total).toBe(1);
		expect(repository.findMany).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			userId: "user-1",
			canViewAll: true,
			page: 2,
			pageSize: 10,
			status: undefined,
			operationType: undefined,
			archived: "active",
		});
	});

	it("restricts list queries to assigned engagements when only assigned-view permission is present", async () => {
		const repository = {
			findMany: vi.fn().mockResolvedValue({ items: [engagement], total: 1 }),
		};
		const useCase = new ListPropertyEngagementsUseCase(repository as never);

		await useCase.execute(
			{ ...tenant, permissions: [PERMISSIONS.ENGAGEMENTS_VIEW_ASSIGNED] },
			currentUser,
			{
				page: 1,
				pageSize: 20,
				status: PropertyEngagementStatus.ACTIVE_PUBLICATION,
				operationType: PropertyOperationType.SALE,
				archived: "archived",
			},
		);

		expect(repository.findMany).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			userId: "user-1",
			canViewAll: false,
			page: 1,
			pageSize: 20,
			status: PropertyEngagementStatus.ACTIVE_PUBLICATION,
			operationType: PropertyOperationType.SALE,
			archived: "archived",
		});
	});

	it("rejects list queries when neither view permission is present", async () => {
		const repository = { findMany: vi.fn() };
		const useCase = new ListPropertyEngagementsUseCase(repository as never);

		await expect(
			useCase.execute({ ...tenant, permissions: [] }, currentUser, {
				page: 1,
				pageSize: 20,
				archived: "active",
			}),
		).rejects.toThrow(new ForbiddenException("Insufficient permissions"));
		expect(repository.findMany).not.toHaveBeenCalled();
	});

	it("returns not found for missing or unassigned engagement details", async () => {
		const repository = { findByIdForTenant: vi.fn().mockResolvedValue(null) };
		const useCase = new GetPropertyEngagementUseCase(repository as never);

		await expect(
			useCase.execute(tenant, currentUser, "missing-engagement"),
		).rejects.toThrow(new NotFoundException("Property engagement not found"));
	});

	it("sets an existing property image as primary", async () => {
		const repository = {
			findByIdForTenant: vi.fn().mockResolvedValue(engagement),
			setImageAsPrimary: vi.fn().mockResolvedValue(propertyImage),
		};
		const useCase = new SetPropertyImagePrimaryUseCase(repository as never);

		await expect(
			useCase.execute(tenant, currentUser, "engagement-1", "image-1"),
		).resolves.toEqual(mapPropertyImage(propertyImage));
		expect(repository.findByIdForTenant).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			engagementId: "engagement-1",
			userId: "user-1",
			canViewAll: true,
		});
		expect(repository.setImageAsPrimary).toHaveBeenCalledWith({
			propertyAssetId: "asset-1",
			imageId: "image-1",
		});
	});

	it("rejects primary image changes without write permission", async () => {
		const repository = {
			findByIdForTenant: vi.fn(),
			setImageAsPrimary: vi.fn(),
		};
		const useCase = new SetPropertyImagePrimaryUseCase(repository as never);

		await expect(
			useCase.execute(
				{ ...tenant, permissions: [PERMISSIONS.ENGAGEMENTS_VIEW_ALL] },
				currentUser,
				"engagement-1",
				"image-1",
			),
		).rejects.toThrow(new ForbiddenException("Insufficient permissions"));
		expect(repository.findByIdForTenant).not.toHaveBeenCalled();
		expect(repository.setImageAsPrimary).not.toHaveBeenCalled();
	});

	it("returns not found when setting a primary image for a missing engagement", async () => {
		const repository = {
			findByIdForTenant: vi.fn().mockResolvedValue(null),
			setImageAsPrimary: vi.fn(),
		};
		const useCase = new SetPropertyImagePrimaryUseCase(repository as never);

		await expect(
			useCase.execute(tenant, currentUser, "missing-engagement", "image-1"),
		).rejects.toThrow(new NotFoundException("Property engagement not found"));
		expect(repository.setImageAsPrimary).not.toHaveBeenCalled();
	});

	it("returns not found when setting a primary image that does not belong to the property", async () => {
		const repository = {
			findByIdForTenant: vi.fn().mockResolvedValue(engagement),
			setImageAsPrimary: vi.fn().mockResolvedValue(null),
		};
		const useCase = new SetPropertyImagePrimaryUseCase(repository as never);

		await expect(
			useCase.execute(tenant, currentUser, "engagement-1", "missing-image"),
		).rejects.toThrow(new NotFoundException("Property image not found"));
	});

	it("validates tenant membership before assigning an agent", async () => {
		const repository = {
			findByIdForTenant: vi.fn().mockResolvedValue(engagement),
			assignAgent: vi.fn().mockResolvedValue({
				status: "assigned",
				assignment: { id: "agent-assignment-1" },
			}),
		};
		const membershipsRepository = {
			findByUserIdAndTenantId: vi
				.fn()
				.mockResolvedValue({ id: "membership-agent-1" }),
		};
		const useCase = new AssignPropertyAgentUseCase(
			repository as never,
			membershipsRepository as never,
		);

		await useCase.execute(tenant, currentUser, "engagement-1", {
			agentUserId: "agent-1",
		});

		expect(membershipsRepository.findByUserIdAndTenantId).toHaveBeenCalledWith(
			"agent-1",
			"tenant-1",
		);
		expect(repository.assignAgent).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			engagementId: "engagement-1",
			agentUserId: "agent-1",
			assignedByUserId: "user-1",
		});
	});

	it("rejects assigning an agent that is not a tenant member", async () => {
		const repository = {
			findByIdForTenant: vi.fn().mockResolvedValue(engagement),
			assignAgent: vi.fn(),
		};
		const membershipsRepository = {
			findByUserIdAndTenantId: vi.fn().mockResolvedValue(null),
		};
		const useCase = new AssignPropertyAgentUseCase(
			repository as never,
			membershipsRepository as never,
		);

		await expect(
			useCase.execute(tenant, currentUser, "engagement-1", {
				agentUserId: "agent-1",
			}),
		).rejects.toThrow(
			new BadRequestException("Agent is not a member of this tenant"),
		);
		expect(repository.assignAgent).not.toHaveBeenCalled();
	});

	it("returns conflict when assigning an already assigned agent", async () => {
		const repository = {
			findByIdForTenant: vi.fn().mockResolvedValue(engagement),
			assignAgent: vi.fn().mockResolvedValue({ status: "alreadyAssigned" }),
		};
		const membershipsRepository = {
			findByUserIdAndTenantId: vi
				.fn()
				.mockResolvedValue({ id: "membership-agent-1" }),
		};
		const useCase = new AssignPropertyAgentUseCase(
			repository as never,
			membershipsRepository as never,
		);

		await expect(
			useCase.execute(tenant, currentUser, "engagement-1", {
				agentUserId: "agent-1",
			}),
		).rejects.toThrow(
			new ConflictException(
				"Agent is already assigned to this property engagement",
			),
		);
	});

	it("removes an agent assignment from a visible engagement", async () => {
		const repository = {
			findByIdForTenant: vi.fn().mockResolvedValue(engagement),
			removeAgent: vi.fn().mockResolvedValue(true),
		};
		const useCase = new RemovePropertyAgentUseCase(repository as never);

		await expect(
			useCase.execute(
				tenant,
				currentUser,
				"engagement-1",
				"agent-assignment-1",
			),
		).resolves.toEqual({ deleted: true, id: "agent-assignment-1" });
		expect(repository.removeAgent).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			engagementId: "engagement-1",
			agentId: "agent-assignment-1",
		});
	});

	it("returns not found when removing an agent from a missing engagement", async () => {
		const repository = {
			findByIdForTenant: vi.fn().mockResolvedValue(null),
			removeAgent: vi.fn(),
		};
		const useCase = new RemovePropertyAgentUseCase(repository as never);

		await expect(
			useCase.execute(
				tenant,
				currentUser,
				"missing-engagement",
				"agent-assignment-1",
			),
		).rejects.toThrow(new NotFoundException("Property engagement not found"));
		expect(repository.removeAgent).not.toHaveBeenCalled();
	});

	it("returns not found when removing an unrelated agent assignment", async () => {
		const repository = {
			findByIdForTenant: vi.fn().mockResolvedValue(engagement),
			removeAgent: vi.fn().mockResolvedValue(false),
		};
		const useCase = new RemovePropertyAgentUseCase(repository as never);

		await expect(
			useCase.execute(tenant, currentUser, "engagement-1", "other-assignment"),
		).rejects.toThrow(
			new NotFoundException("Property agent assignment not found"),
		);
	});

	it("lists assignable property agents for a tenant", async () => {
		const membershipsRepository = {
			findManyByTenantId: vi.fn().mockResolvedValue([
				{
					userId: "manager-1",
					role: TenantRole.MANAGER,
					user: { email: "manager@example.com", firstName: "Manager" },
				},
				{
					userId: "agent-1",
					role: TenantRole.AGENT,
					user: { email: "agent@example.com", firstName: "Agent" },
				},
			]),
		};
		const useCase = new ListAssignablePropertyAgentsUseCase(
			membershipsRepository as never,
		);

		await expect(useCase.execute(tenant)).resolves.toEqual({
			items: [
				{
					userId: "manager-1",
					email: "manager@example.com",
					firstName: "Manager",
					role: TenantRole.MANAGER,
				},
				{
					userId: "agent-1",
					email: "agent@example.com",
					firstName: "Agent",
					role: TenantRole.AGENT,
				},
			],
		});
		expect(membershipsRepository.findManyByTenantId).toHaveBeenCalledWith(
			"tenant-1",
		);
	});

	it("rejects assignable property agents listing without team or engagement permissions", async () => {
		const membershipsRepository = { findManyByTenantId: vi.fn() };
		const useCase = new ListAssignablePropertyAgentsUseCase(
			membershipsRepository as never,
		);
		const readOnlyTenant = {
			...tenant,
			permissions: [PERMISSIONS.TENANT_VIEW],
		};

		await expect(useCase.execute(readOnlyTenant)).rejects.toThrow(
			new ForbiddenException("Insufficient permissions"),
		);
		expect(membershipsRepository.findManyByTenantId).not.toHaveBeenCalled();
	});
});
