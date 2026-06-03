import {
	BadRequestException,
	ForbiddenException,
	NotFoundException,
} from "@nestjs/common";
import {
	AnalyticsActorType,
	AnalyticsEventName,
	InterestLevel,
	MovementSource,
	MovementType,
	PropertyEngagementStatus,
	PropertyOperationType,
	PropertyType,
	TenantRole,
	TenantStatus,
	UserStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { mapMovement } from "../src/movements/responses/movement.response";
import { CreateMovementUseCase } from "../src/movements/use-cases/create-movement.use-case";
import { ListMovementsUseCase } from "../src/movements/use-cases/list-movements.use-case";
import { PERMISSIONS } from "../src/permissions/permissions.constants";
import type { TenantContext } from "../src/tenant-context/tenant-context.types";

const managerTenant: TenantContext = {
	tenantId: "tenant-1",
	tenantSlug: "tenant-one",
	tenantStatus: TenantStatus.ACTIVE,
	membershipId: "membership-1",
	role: TenantRole.PRINCIPAL_MANAGER,
	permissions: [PERMISSIONS.ENGAGEMENTS_VIEW_ALL, PERMISSIONS.MOVEMENTS_CREATE],
	userStatus: UserStatus.ACTIVE,
};

const assignedAgentTenant: TenantContext = {
	...managerTenant,
	role: TenantRole.AGENT,
	permissions: [
		PERMISSIONS.ENGAGEMENTS_VIEW_ASSIGNED,
		PERMISSIONS.MOVEMENTS_CREATE,
	],
};

const currentUser = { id: "user-1", email: "user@example.com" };

const engagement = {
	id: "engagement-1",
	tenantId: "tenant-1",
	propertyAssetId: "asset-1",
	operationType: PropertyOperationType.SALE,
	status: PropertyEngagementStatus.ACTIVE_PUBLICATION,
	publishedPriceCents: 35000000,
	currency: "ARS",
	createdByUserId: "creator-1",
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	updatedAt: new Date("2026-01-02T00:00:00.000Z"),
	propertyAsset: {
		id: "asset-1",
		title: "Palermo house",
		addressLine: "Uriarte 1234",
		city: "Buenos Aires",
		province: "CABA",
		propertyType: PropertyType.HOUSE,
		ownerName: "Owner Example",
		ownerEmail: "owner@example.com",
		createdByUserId: "creator-1",
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-02T00:00:00.000Z"),
	},
	agents: [],
	createdBy: {
		id: "creator-1",
		email: "creator@example.com",
		passwordHash: "creator-secret-hash",
		firstName: "Creator",
		lastName: "Example",
		status: UserStatus.ACTIVE,
		emailVerifiedAt: null,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-02T00:00:00.000Z"),
	},
};

const movement = {
	id: "movement-1",
	tenantId: "tenant-1",
	propertyEngagementId: "engagement-1",
	createdByUserId: "user-1",
	type: MovementType.INQUIRY,
	observation: "Buyer asked for a visit.",
	nextStep: "Schedule visit",
	previousStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
	newStatus: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
	source: MovementSource.MANUAL,
	interestCount: 2,
	visitCount: 1,
	offerAmountCents: 25000000,
	interestLevel: InterestLevel.HIGH,
	createdAt: new Date("2026-02-01T10:00:00.000Z"),
	createdBy: {
		id: "user-1",
		email: "user@example.com",
		passwordHash: "secret-hash",
		firstName: "Agent",
		lastName: "Example",
		status: UserStatus.ACTIVE,
		emailVerifiedAt: null,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-02T00:00:00.000Z"),
	},
};

describe("Movement response mapper", () => {
	it("maps movement details to safe response fields only", () => {
		expect(mapMovement(movement)).toEqual({
			id: "movement-1",
			tenantId: "tenant-1",
			propertyEngagementId: "engagement-1",
			type: MovementType.INQUIRY,
			observation: "Buyer asked for a visit.",
			nextStep: "Schedule visit",
			previousStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
			newStatus: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
			source: MovementSource.MANUAL,
			interestCount: 2,
			visitCount: 1,
			offerAmountCents: 25000000,
			interestLevel: InterestLevel.HIGH,
			createdBy: {
				id: "user-1",
				email: "user@example.com",
				firstName: "Agent",
			},
			createdAt: "2026-02-01T10:00:00.000Z",
		});
	});
});

describe("Movement use cases", () => {
	it("allows a manager to create a movement after verifying engagement visibility", async () => {
		const propertyEngagementsRepository = {
			findByIdForTenant: vi.fn().mockResolvedValue(engagement),
		};
		const movementsRepository = {
			create: vi.fn().mockResolvedValue(movement),
			listActiveOwnerUserIdsForEngagement: vi
				.fn()
				.mockResolvedValue(["owner-1", "owner-2"]),
		};
		const analyticsService = {
			track: vi.fn().mockResolvedValue({ status: "persisted" }),
		};
		const notificationProducer = makeNotificationProducer();
		const useCase = new CreateMovementUseCase(
			movementsRepository as never,
			propertyEngagementsRepository as never,
			analyticsService as never,
			notificationProducer as never,
		);

		const result = await useCase.execute(
			managerTenant,
			currentUser,
			"engagement-1",
			{
				type: MovementType.INQUIRY,
				observation: "Buyer asked for a visit.",
				newStatus: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
			},
		);

		expect(result.id).toBe("movement-1");
		expect(
			propertyEngagementsRepository.findByIdForTenant,
		).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			engagementId: "engagement-1",
			userId: "user-1",
			canViewAll: true,
		});
		expect(movementsRepository.create).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			propertyEngagementId: "engagement-1",
			createdByUserId: "user-1",
			type: MovementType.INQUIRY,
			observation: "Buyer asked for a visit.",
			nextStep: undefined,
			newStatus: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
			interestCount: undefined,
			visitCount: undefined,
			offerAmountCents: undefined,
			interestLevel: undefined,
		});
		expect(analyticsService.track).toHaveBeenCalledWith({
			eventName: AnalyticsEventName.MOVEMENT_CREATED,
			actorType: AnalyticsActorType.INTERNAL_USER,
			tenantId: "tenant-1",
			actorUserId: "user-1",
			propertyEngagementId: "engagement-1",
			movementId: "movement-1",
		});
		expect(analyticsService.track).toHaveBeenCalledWith({
			eventName: AnalyticsEventName.PROPERTY_STATUS_CHANGED,
			actorType: AnalyticsActorType.INTERNAL_USER,
			tenantId: "tenant-1",
			actorUserId: "user-1",
			propertyEngagementId: "engagement-1",
			movementId: "movement-1",
			metadata: {
				previousStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
				newStatus: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
			},
		});
		expect(
			movementsRepository.listActiveOwnerUserIdsForEngagement,
		).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			propertyEngagementId: "engagement-1",
		});
		expect(
			notificationProducer.notifyPropertyStatusChanged,
		).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			ownerUserIds: ["owner-1", "owner-2"],
			propertyEngagementId: "engagement-1",
			propertyAssetId: "asset-1",
			movementId: "movement-1",
			previousStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
			newStatus: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
		});
		expect(
			JSON.stringify(
				vi.mocked(notificationProducer.notifyPropertyStatusChanged).mock.calls,
			),
		).not.toContain("Buyer asked for a visit.");
	});

	it("does not emit status change analytics when the movement leaves status unchanged", async () => {
		const propertyEngagementsRepository = {
			findByIdForTenant: vi.fn().mockResolvedValue(engagement),
		};
		const movementsRepository = {
			create: vi.fn().mockResolvedValue({ ...movement, newStatus: null }),
			listActiveOwnerUserIdsForEngagement: vi.fn(),
		};
		const analyticsService = {
			track: vi.fn().mockResolvedValue({ status: "persisted" }),
		};
		const notificationProducer = makeNotificationProducer();
		const useCase = new CreateMovementUseCase(
			movementsRepository as never,
			propertyEngagementsRepository as never,
			analyticsService as never,
			notificationProducer as never,
		);

		await useCase.execute(managerTenant, currentUser, "engagement-1", {
			type: MovementType.GENERAL_UPDATE,
			observation: "Owner was updated without a status change.",
		});

		expect(analyticsService.track).toHaveBeenCalledTimes(1);
		expect(analyticsService.track).toHaveBeenCalledWith({
			eventName: AnalyticsEventName.MOVEMENT_CREATED,
			actorType: AnalyticsActorType.INTERNAL_USER,
			tenantId: "tenant-1",
			actorUserId: "user-1",
			propertyEngagementId: "engagement-1",
			movementId: "movement-1",
		});
		expect(
			movementsRepository.listActiveOwnerUserIdsForEngagement,
		).not.toHaveBeenCalled();
		expect(
			notificationProducer.notifyPropertyStatusChanged,
		).not.toHaveBeenCalled();
	});

	it("keeps movement creation successful when analytics tracking fails", async () => {
		const propertyEngagementsRepository = {
			findByIdForTenant: vi.fn().mockResolvedValue(engagement),
		};
		const movementsRepository = {
			create: vi.fn().mockResolvedValue(movement),
			listActiveOwnerUserIdsForEngagement: vi
				.fn()
				.mockResolvedValue(["owner-1"]),
		};
		const analyticsService = {
			track: vi.fn().mockRejectedValue(new Error("analytics unavailable")),
		};
		const useCase = new CreateMovementUseCase(
			movementsRepository as never,
			propertyEngagementsRepository as never,
			analyticsService as never,
			makeNotificationProducer() as never,
		);

		const result = await useCase.execute(
			managerTenant,
			currentUser,
			"engagement-1",
			{
				type: MovementType.INQUIRY,
				observation: "Buyer asked for a visit.",
				newStatus: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
			},
		);

		expect(result.id).toBe("movement-1");
		expect(analyticsService.track).toHaveBeenCalled();
	});

	it("keeps movement creation successful when status notification fails", async () => {
		const propertyEngagementsRepository = {
			findByIdForTenant: vi.fn().mockResolvedValue(engagement),
		};
		const movementsRepository = {
			create: vi.fn().mockResolvedValue(movement),
			listActiveOwnerUserIdsForEngagement: vi
				.fn()
				.mockResolvedValue(["owner-1"]),
		};
		const notificationProducer = makeNotificationProducer({
			notifyPropertyStatusChanged: vi
				.fn()
				.mockRejectedValue(new Error("notifications unavailable")),
		});
		const useCase = new CreateMovementUseCase(
			movementsRepository as never,
			propertyEngagementsRepository as never,
			{ track: vi.fn().mockResolvedValue({ status: "persisted" }) } as never,
			notificationProducer as never,
		);

		await expect(
			useCase.execute(managerTenant, currentUser, "engagement-1", {
				type: MovementType.INQUIRY,
				observation: "Buyer asked for a visit.",
				newStatus: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
			}),
		).resolves.toMatchObject({ id: "movement-1" });
	});

	it("allows an assigned agent to create a movement using assigned visibility", async () => {
		const propertyEngagementsRepository = {
			findByIdForTenant: vi.fn().mockResolvedValue(engagement),
		};
		const movementsRepository = {
			create: vi
				.fn()
				.mockResolvedValue({ ...movement, id: "movement-agent-1" }),
		};
		const useCase = new CreateMovementUseCase(
			movementsRepository as never,
			propertyEngagementsRepository as never,
			{ track: vi.fn() } as never,
			makeNotificationProducer() as never,
		);

		const result = await useCase.execute(
			assignedAgentTenant,
			currentUser,
			"engagement-1",
			{
				type: MovementType.GENERAL_UPDATE,
				observation: "Owner approved listing copy.",
			},
		);

		expect(result.id).toBe("movement-agent-1");
		expect(
			propertyEngagementsRepository.findByIdForTenant,
		).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			engagementId: "engagement-1",
			userId: "user-1",
			canViewAll: false,
		});
	});

	it.each([
		MovementType.ARCHIVED,
		MovementType.RESTORED,
	])("rejects lifecycle movement type %s from generic movement creation", async (type) => {
		const propertyEngagementsRepository = {
			findByIdForTenant: vi.fn().mockResolvedValue(engagement),
		};
		const movementsRepository = { create: vi.fn() };
		const analyticsService = { track: vi.fn() };
		const useCase = new CreateMovementUseCase(
			movementsRepository as never,
			propertyEngagementsRepository as never,
			analyticsService as never,
			makeNotificationProducer() as never,
		);

		await expect(
			useCase.execute(managerTenant, currentUser, "engagement-1", {
				type,
				observation: "Lifecycle movement should use lifecycle endpoints.",
			}),
		).rejects.toThrow(
			new BadRequestException(
				"Lifecycle movements must be created through property lifecycle actions",
			),
		);
		expect(
			propertyEngagementsRepository.findByIdForTenant,
		).not.toHaveBeenCalled();
		expect(movementsRepository.create).not.toHaveBeenCalled();
		expect(analyticsService.track).not.toHaveBeenCalled();
	});

	it("returns not found for unassigned or cross-tenant engagement movement creation", async () => {
		const propertyEngagementsRepository = {
			findByIdForTenant: vi.fn().mockResolvedValue(null),
		};
		const movementsRepository = { create: vi.fn() };
		const useCase = new CreateMovementUseCase(
			movementsRepository as never,
			propertyEngagementsRepository as never,
			{ track: vi.fn() } as never,
			makeNotificationProducer() as never,
		);

		await expect(
			useCase.execute(
				assignedAgentTenant,
				currentUser,
				"unassigned-engagement",
				{
					type: MovementType.GENERAL_UPDATE,
					observation: "Should not reveal existence.",
				},
			),
		).rejects.toThrow(new NotFoundException("Property engagement not found"));
		expect(movementsRepository.create).not.toHaveBeenCalled();
	});

	it("rejects movement creation when the movement permission is missing", async () => {
		const propertyEngagementsRepository = { findByIdForTenant: vi.fn() };
		const movementsRepository = { create: vi.fn() };
		const useCase = new CreateMovementUseCase(
			movementsRepository as never,
			propertyEngagementsRepository as never,
			{ track: vi.fn() } as never,
			makeNotificationProducer() as never,
		);

		await expect(
			useCase.execute(
				{ ...managerTenant, permissions: [PERMISSIONS.ENGAGEMENTS_VIEW_ALL] },
				currentUser,
				"engagement-1",
				{
					type: MovementType.GENERAL_UPDATE,
					observation: "Missing permission.",
				},
			),
		).rejects.toThrow(new ForbiddenException("Insufficient permissions"));
		expect(
			propertyEngagementsRepository.findByIdForTenant,
		).not.toHaveBeenCalled();
		expect(movementsRepository.create).not.toHaveBeenCalled();
	});

	it("maps repository null on create to the same not found response", async () => {
		const propertyEngagementsRepository = {
			findByIdForTenant: vi.fn().mockResolvedValue(engagement),
		};
		const movementsRepository = { create: vi.fn().mockResolvedValue(null) };
		const useCase = new CreateMovementUseCase(
			movementsRepository as never,
			propertyEngagementsRepository as never,
			{ track: vi.fn() } as never,
			makeNotificationProducer() as never,
		);

		await expect(
			useCase.execute(managerTenant, currentUser, "engagement-1", {
				type: MovementType.GENERAL_UPDATE,
				observation: "Engagement disappeared before create.",
			}),
		).rejects.toThrow(new NotFoundException("Property engagement not found"));
	});

	it("maps paginated movement lists after verifying engagement visibility", async () => {
		const secondMovement = {
			...movement,
			id: "movement-2",
			observation: "Offer received.",
			createdAt: new Date("2026-02-02T10:00:00.000Z"),
		};
		const propertyEngagementsRepository = {
			findByIdForTenant: vi.fn().mockResolvedValue(engagement),
		};
		const movementsRepository = {
			findMany: vi
				.fn()
				.mockResolvedValue({ items: [movement, secondMovement], total: 2 }),
		};
		const useCase = new ListMovementsUseCase(
			movementsRepository as never,
			propertyEngagementsRepository as never,
		);

		const result = await useCase.execute(
			assignedAgentTenant,
			currentUser,
			"engagement-1",
			{
				page: 2,
				pageSize: 10,
				order: "asc",
			},
		);

		expect(result).toEqual({
			items: [mapMovement(movement), mapMovement(secondMovement)],
			total: 2,
			page: 2,
			pageSize: 10,
		});
		expect(
			propertyEngagementsRepository.findByIdForTenant,
		).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			engagementId: "engagement-1",
			userId: "user-1",
			canViewAll: false,
		});
		expect(movementsRepository.findMany).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			propertyEngagementId: "engagement-1",
			page: 2,
			pageSize: 10,
			order: "asc",
		});
	});

	it("rejects movement lists when neither engagement view permission is present", async () => {
		const propertyEngagementsRepository = { findByIdForTenant: vi.fn() };
		const movementsRepository = { findMany: vi.fn() };
		const useCase = new ListMovementsUseCase(
			movementsRepository as never,
			propertyEngagementsRepository as never,
		);

		await expect(
			useCase.execute(
				{ ...managerTenant, permissions: [PERMISSIONS.MOVEMENTS_CREATE] },
				currentUser,
				"engagement-1",
				{},
			),
		).rejects.toThrow(new ForbiddenException("Insufficient permissions"));
		expect(
			propertyEngagementsRepository.findByIdForTenant,
		).not.toHaveBeenCalled();
		expect(movementsRepository.findMany).not.toHaveBeenCalled();
	});
});

function makeNotificationProducer(
	overrides: Partial<{
		notifyPropertyStatusChanged: ReturnType<typeof vi.fn>;
	}> = {},
) {
	return {
		notifyPropertyStatusChanged: vi.fn().mockResolvedValue(undefined),
		...overrides,
	};
}
