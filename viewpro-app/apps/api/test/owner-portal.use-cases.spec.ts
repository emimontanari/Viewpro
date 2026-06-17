import { NotFoundException } from "@nestjs/common";
import { AnalyticsActorType, AnalyticsEventName } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { OwnerPortalRepository } from "../src/owner-portal/owner-portal.repository";
import { GetOwnerEngagementTimelineUseCase } from "../src/owner-portal/use-cases/get-owner-engagement-timeline.use-case";
import { GetOwnerPropertyUseCase } from "../src/owner-portal/use-cases/get-owner-property.use-case";
import { ListOwnerPropertiesUseCase } from "../src/owner-portal/use-cases/list-owner-properties.use-case";
import { ListOwnerPropertyEngagementsUseCase } from "../src/owner-portal/use-cases/list-owner-property-engagements.use-case";
import { TrackOwnerMovementWhatsappContactClickUseCase } from "../src/owner-portal/use-cases/track-owner-movement-whatsapp-contact-click.use-case";
import { TrackOwnerWhatsappContactClickUseCase } from "../src/owner-portal/use-cases/track-owner-whatsapp-contact-click.use-case";

describe("Owner portal use cases", () => {
	it("lists mapped owner properties for the current user", async () => {
		const property = makeProperty({
			id: "property-1",
			title: "Owner apartment",
		});
		const repository = makeRepository({
			findPropertiesByOwnerUserId: vi.fn().mockResolvedValue([property]),
		});
		const useCase = new ListOwnerPropertiesUseCase(repository);

		const result = await useCase.execute("owner-1");

		expect(repository.findPropertiesByOwnerUserId).toHaveBeenCalledWith(
			"owner-1",
		);
		expect(result).toEqual([
			{
				id: "property-1",
				title: "Owner apartment",
				addressLine: "Av. Corrientes 1234",
				city: "Buenos Aires",
				province: "CABA",
				propertyType: "APARTMENT",
				totalAreaSqm: null,
				coveredAreaSqm: null,
				rooms: null,
				bedrooms: null,
				bathrooms: null,
				garages: null,
				ageYears: null,
				orientation: null,
				images: [],
				primaryImage: null,
				createdAt: "2026-01-01T00:00:00.000Z",
				updatedAt: "2026-01-02T00:00:00.000Z",
			},
		]);
	});

	it("gets a mapped owner property when access exists", async () => {
		const property = makeProperty({ id: "property-2", title: "Townhouse" });
		const repository = makeRepository({
			findPropertyByOwner: vi.fn().mockResolvedValue(property),
		});
		const analyticsService = {
			track: vi.fn().mockResolvedValue({ status: "persisted" }),
		};
		const useCase = new GetOwnerPropertyUseCase(
			repository,
			analyticsService as never,
		);

		const result = await useCase.execute({
			userId: "owner-1",
			propertyAssetId: "property-2",
		});

		expect(repository.findPropertyByOwner).toHaveBeenCalledWith({
			userId: "owner-1",
			propertyAssetId: "property-2",
		});
		expect(result).toEqual(
			expect.objectContaining({
				id: "property-2",
				title: "Townhouse",
				createdAt: "2026-01-01T00:00:00.000Z",
			}),
		);
		expect(analyticsService.track).toHaveBeenCalledWith({
			eventName: AnalyticsEventName.OWNER_VIEWED_PROPERTY,
			actorType: AnalyticsActorType.OWNER,
			actorUserId: "owner-1",
			propertyAssetId: "property-2",
		});
	});

	it("keeps owner property detail successful when analytics tracking fails", async () => {
		const property = makeProperty({ id: "property-2", title: "Townhouse" });
		const repository = makeRepository({
			findPropertyByOwner: vi.fn().mockResolvedValue(property),
		});
		const analyticsService = {
			track: vi.fn().mockRejectedValue(new Error("analytics unavailable")),
		};
		const useCase = new GetOwnerPropertyUseCase(
			repository,
			analyticsService as never,
		);

		await expect(
			useCase.execute({ userId: "owner-1", propertyAssetId: "property-2" }),
		).resolves.toMatchObject({ id: "property-2" });
	});

	it("does not wait for owner property analytics before returning the detail", async () => {
		const property = makeProperty({ id: "property-2", title: "Townhouse" });
		const repository = makeRepository({
			findPropertyByOwner: vi.fn().mockResolvedValue(property),
		});
		const analyticsService = {
			track: vi.fn().mockReturnValue(new Promise(() => undefined)),
		};
		const useCase = new GetOwnerPropertyUseCase(
			repository,
			analyticsService as never,
		);

		const result = await Promise.race([
			useCase.execute({ userId: "owner-1", propertyAssetId: "property-2" }),
			new Promise<"blocked">((resolve) =>
				setTimeout(() => resolve("blocked"), 50),
			),
		]);

		expect(result).toMatchObject({ id: "property-2" });
		expect(analyticsService.track).toHaveBeenCalledWith({
			eventName: AnalyticsEventName.OWNER_VIEWED_PROPERTY,
			actorType: AnalyticsActorType.OWNER,
			actorUserId: "owner-1",
			propertyAssetId: "property-2",
		});
	});

	it("throws 404 when an owner property is missing", async () => {
		const repository = makeRepository({
			findPropertyByOwner: vi.fn().mockResolvedValue(null),
		});
		const useCase = new GetOwnerPropertyUseCase(repository, {
			track: vi.fn(),
		} as never);

		await expect(
			useCase.execute({
				userId: "owner-1",
				propertyAssetId: "missing-property",
			}),
		).rejects.toThrow(new NotFoundException("Owner property not found"));
		expect(repository.findPropertyByOwner).toHaveBeenCalledWith({
			userId: "owner-1",
			propertyAssetId: "missing-property",
		});
	});

	it("checks property access before listing owner property engagements", async () => {
		const property = makeProperty({ id: "property-1" });
		const engagement = makeEngagement({
			id: "engagement-1",
			propertyAssetId: "property-1",
		});
		const repository = makeRepository({
			findPropertyByOwner: vi.fn().mockResolvedValue(property),
			findEngagementsForOwnerProperty: vi.fn().mockResolvedValue([engagement]),
		});
		const useCase = new ListOwnerPropertyEngagementsUseCase(repository);

		const result = await useCase.execute({
			userId: "owner-1",
			propertyAssetId: "property-1",
		});

		expect(repository.findPropertyByOwner).toHaveBeenCalledWith({
			userId: "owner-1",
			propertyAssetId: "property-1",
		});
		expect(repository.findEngagementsForOwnerProperty).toHaveBeenCalledWith({
			userId: "owner-1",
			propertyAssetId: "property-1",
		});
		expect(result).toEqual([
			expect.objectContaining({
				id: "engagement-1",
				tenant: { id: "tenant-1", name: "Acme Realty" },
				contact: {
					available: false,
					targetType: "tenant",
					displayLabel: "Contacto no configurado",
				},
				agents: [
					{ userId: "agent-1", firstName: "Ada", email: "ada@example.com" },
				],
			}),
		]);
	});

	it("maps tenant WhatsApp contact when listing owner property engagements", async () => {
		const property = makeProperty({ id: "property-1" });
		const engagement = makeEngagement({
			id: "engagement-1",
			propertyAssetId: "property-1",
			tenant: {
				id: "tenant-1",
				name: "Acme Realty",
				whatsappPhone: "+5493510000000",
			},
		});
		const repository = makeRepository({
			findPropertyByOwner: vi.fn().mockResolvedValue(property),
			findEngagementsForOwnerProperty: vi.fn().mockResolvedValue([engagement]),
		});
		const useCase = new ListOwnerPropertyEngagementsUseCase(repository);

		const result = await useCase.execute({
			userId: "owner-1",
			propertyAssetId: "property-1",
		});

		expect(result[0]).toEqual(
			expect.objectContaining({
				tenant: { id: "tenant-1", name: "Acme Realty" },
				contact: {
					available: true,
					targetType: "tenant",
					displayLabel: "Contactar inmobiliaria",
					whatsappPhone: "+5493510000000",
				},
			}),
		);
		expect(result[0].tenant).not.toHaveProperty("whatsappPhone");
	});

	it("does not list engagements when owner property access is missing", async () => {
		const repository = makeRepository({
			findPropertyByOwner: vi.fn().mockResolvedValue(null),
			findEngagementsForOwnerProperty: vi.fn(),
		});
		const useCase = new ListOwnerPropertyEngagementsUseCase(repository);

		await expect(
			useCase.execute({ userId: "owner-1", propertyAssetId: "property-1" }),
		).rejects.toThrow(new NotFoundException("Owner property not found"));
		expect(repository.findEngagementsForOwnerProperty).not.toHaveBeenCalled();
	});

	it("returns mapped owner engagement timeline pagination", async () => {
		const engagement = makeEngagement({ id: "engagement-1" });
		const movement = makeMovement({
			id: "movement-1",
			propertyEngagementId: "engagement-1",
		});
		const repository = makeRepository({
			findEngagementTimelineForOwner: vi
				.fn()
				.mockResolvedValue({ engagement, items: [movement], total: 1 }),
		});
		const useCase = new GetOwnerEngagementTimelineUseCase(repository);

		const result = await useCase.execute({
			userId: "owner-1",
			engagementId: "engagement-1",
			page: 2,
			pageSize: 10,
			order: "asc",
		});

		expect(repository.findEngagementTimelineForOwner).toHaveBeenCalledWith({
			userId: "owner-1",
			engagementId: "engagement-1",
			page: 2,
			pageSize: 10,
			order: "asc",
		});
		expect(result).toEqual({
			engagement: expect.objectContaining({
				id: "engagement-1",
				tenant: { id: "tenant-1", name: "Acme Realty" },
			}),
			items: [
				expect.objectContaining({
					id: "movement-1",
					contact: {
						available: false,
						targetType: "assigned_seller",
						displayLabel: "Contacto no configurado",
					},
					createdAt: "2026-01-05T00:00:00.000Z",
				}),
			],
			total: 1,
			page: 2,
			pageSize: 10,
		});
	});

	it("maps assigned seller WhatsApp contact in owner engagement timeline", async () => {
		const engagement = makeEngagement({ id: "engagement-1" });
		const movement = makeMovement({
			id: "movement-1",
			propertyEngagementId: "engagement-1",
			propertyEngagement: {
				agents: [
					{
						agentUserId: "agent-1",
						assignedAt: new Date("2024-01-01T00:00:00.000Z"),
						agentUser: { whatsappPhone: "+5493510000000" },
					},
				],
			},
		});
		const repository = makeRepository({
			findEngagementTimelineForOwner: vi
				.fn()
				.mockResolvedValue({ engagement, items: [movement], total: 1 }),
		});
		const useCase = new GetOwnerEngagementTimelineUseCase(repository);

		const result = await useCase.execute({
			userId: "owner-1",
			engagementId: "engagement-1",
			page: 1,
			pageSize: 20,
			order: "desc",
		});

		expect(result.items[0]).toEqual(
			expect.objectContaining({
				contact: {
					available: true,
					targetType: "assigned_seller",
					displayLabel: "Consultar responsable",
					whatsappPhone: "+5493510000000",
				},
			}),
		);
		expect(result.items[0].createdBy).toEqual({
			id: "agent-1",
			email: "ada@example.com",
			firstName: "Ada",
		});
		expect(result.items[0].createdBy).not.toHaveProperty("whatsappPhone");
	});

	it("does not fallback to tenant contact when assigned seller has no valid phone", async () => {
		const engagement = makeEngagement({
			id: "engagement-1",
			tenant: {
				id: "tenant-1",
				name: "Acme Realty",
				whatsappPhone: "+5493519999999",
			},
		});
		const movement = makeMovement({
			id: "movement-1",
			propertyEngagementId: "engagement-1",
			propertyEngagement: {
				agents: [
					{
						agentUserId: "agent-1",
						assignedAt: new Date("2024-01-01T00:00:00.000Z"),
						agentUser: { whatsappPhone: null },
					},
				],
			},
		});
		const repository = makeRepository({
			findEngagementTimelineForOwner: vi
				.fn()
				.mockResolvedValue({ engagement, items: [movement], total: 1 }),
		});
		const useCase = new GetOwnerEngagementTimelineUseCase(repository);

		const result = await useCase.execute({
			userId: "owner-1",
			engagementId: "engagement-1",
			page: 1,
			pageSize: 20,
			order: "desc",
		});

		expect(result.items[0].contact).toEqual({
			available: false,
			targetType: "assigned_seller",
			displayLabel: "Contacto no configurado",
		});
		expect(result.items[0].contact).not.toHaveProperty("whatsappPhone");
	});

	it("tracks owner WhatsApp contact clicks with safe analytics metadata", async () => {
		const repository = makeRepository({
			findEngagementContactContextForOwner: vi.fn().mockResolvedValue({
				id: "engagement-1",
				tenantId: "tenant-1",
				propertyAssetId: "property-1",
			}),
		});
		const analyticsService = {
			track: vi.fn().mockResolvedValue({ status: "persisted" }),
		};
		const useCase = new TrackOwnerWhatsappContactClickUseCase(
			repository,
			analyticsService as never,
		);

		await expect(
			useCase.execute({ userId: "owner-1", engagementId: "engagement-1" }),
		).resolves.toBeUndefined();

		expect(
			repository.findEngagementContactContextForOwner,
		).toHaveBeenCalledWith({
			userId: "owner-1",
			engagementId: "engagement-1",
		});
		expect(analyticsService.track).toHaveBeenCalledWith({
			eventName: AnalyticsEventName.WHATSAPP_CONTACT_CLICKED,
			actorType: AnalyticsActorType.OWNER,
			actorUserId: "owner-1",
			tenantId: "tenant-1",
			propertyEngagementId: "engagement-1",
			propertyAssetId: "property-1",
			metadata: { context: "property", targetType: "tenant" },
		});
	});

	it("rejects owner WhatsApp contact clicks for inaccessible engagements", async () => {
		const repository = makeRepository({
			findEngagementContactContextForOwner: vi.fn().mockResolvedValue(null),
		});
		const analyticsService = { track: vi.fn() };
		const useCase = new TrackOwnerWhatsappContactClickUseCase(
			repository,
			analyticsService as never,
		);

		await expect(
			useCase.execute({
				userId: "owner-1",
				engagementId: "missing-engagement",
			}),
		).rejects.toThrow(new NotFoundException("Owner engagement not found"));
		expect(analyticsService.track).not.toHaveBeenCalled();
	});

	it("keeps owner WhatsApp contact clicks successful when analytics fails", async () => {
		const repository = makeRepository({
			findEngagementContactContextForOwner: vi.fn().mockResolvedValue({
				id: "engagement-1",
				tenantId: "tenant-1",
				propertyAssetId: "property-1",
			}),
		});
		const analyticsService = {
			track: vi.fn().mockRejectedValue(new Error("analytics unavailable")),
		};
		const useCase = new TrackOwnerWhatsappContactClickUseCase(
			repository,
			analyticsService as never,
		);

		await expect(
			useCase.execute({ userId: "owner-1", engagementId: "engagement-1" }),
		).resolves.toBeUndefined();
	});

	it("tracks owner movement WhatsApp contact clicks with safe analytics metadata", async () => {
		const repository = makeRepository({
			findMovementContactContextForOwner: vi.fn().mockResolvedValue({
				id: "movement-1",
				tenantId: "tenant-1",
				propertyEngagementId: "engagement-1",
				propertyAssetId: "property-1",
			}),
		});
		const analyticsService = {
			track: vi.fn().mockResolvedValue({ status: "persisted" }),
		};
		const useCase = new TrackOwnerMovementWhatsappContactClickUseCase(
			repository,
			analyticsService as never,
		);

		await expect(
			useCase.execute({
				userId: "owner-1",
				engagementId: "engagement-1",
				movementId: "movement-1",
			}),
		).resolves.toBeUndefined();

		expect(repository.findMovementContactContextForOwner).toHaveBeenCalledWith({
			userId: "owner-1",
			engagementId: "engagement-1",
			movementId: "movement-1",
		});
		expect(analyticsService.track).toHaveBeenCalledWith({
			eventName: AnalyticsEventName.WHATSAPP_CONTACT_CLICKED,
			actorType: AnalyticsActorType.OWNER,
			actorUserId: "owner-1",
			tenantId: "tenant-1",
			propertyEngagementId: "engagement-1",
			propertyAssetId: "property-1",
			movementId: "movement-1",
			metadata: { context: "movement", targetType: "assigned_seller" },
		});
	});

	it("rejects owner movement WhatsApp contact clicks for inaccessible movements", async () => {
		const repository = makeRepository({
			findMovementContactContextForOwner: vi.fn().mockResolvedValue(null),
		});
		const analyticsService = { track: vi.fn() };
		const useCase = new TrackOwnerMovementWhatsappContactClickUseCase(
			repository,
			analyticsService as never,
		);

		await expect(
			useCase.execute({
				userId: "owner-1",
				engagementId: "engagement-1",
				movementId: "missing-movement",
			}),
		).rejects.toThrow(new NotFoundException("Owner movement not found"));
		expect(analyticsService.track).not.toHaveBeenCalled();
	});

	it("keeps owner movement WhatsApp contact clicks successful when analytics fails", async () => {
		const repository = makeRepository({
			findMovementContactContextForOwner: vi.fn().mockResolvedValue({
				id: "movement-1",
				tenantId: "tenant-1",
				propertyEngagementId: "engagement-1",
				propertyAssetId: "property-1",
			}),
		});
		const analyticsService = {
			track: vi.fn().mockRejectedValue(new Error("analytics unavailable")),
		};
		const useCase = new TrackOwnerMovementWhatsappContactClickUseCase(
			repository,
			analyticsService as never,
		);

		await expect(
			useCase.execute({
				userId: "owner-1",
				engagementId: "engagement-1",
				movementId: "movement-1",
			}),
		).resolves.toBeUndefined();
	});

	it("throws 404 when an owner engagement timeline is missing", async () => {
		const repository = makeRepository({
			findEngagementTimelineForOwner: vi
				.fn()
				.mockResolvedValue({ engagement: null, items: [], total: 0 }),
		});
		const useCase = new GetOwnerEngagementTimelineUseCase(repository);

		await expect(
			useCase.execute({
				userId: "owner-1",
				engagementId: "missing-engagement",
				page: 1,
				pageSize: 20,
				order: "desc",
			}),
		).rejects.toThrow(new NotFoundException("Owner engagement not found"));
	});

	// S-1: assigned seller has phone; movement creator does not
	it("S-1: resolves contact from assigned seller when creator has no phone", async () => {
		const engagement = makeEngagement({ id: "engagement-1" });
		const movement = makeMovement({
			id: "movement-1",
			propertyEngagementId: "engagement-1",
			createdBy: {
				id: "manager-1",
				email: "manager@example.com",
				firstName: "Manager",
				whatsappPhone: null,
			},
			propertyEngagement: {
				agents: [
					{
						agentUserId: "seller-1",
						assignedAt: new Date("2024-01-01T00:00:00.000Z"),
						agentUser: { whatsappPhone: "+5493512222222" },
					},
				],
			},
		});
		const repository = makeRepository({
			findEngagementTimelineForOwner: vi
				.fn()
				.mockResolvedValue({ engagement, items: [movement], total: 1 }),
		});
		const useCase = new GetOwnerEngagementTimelineUseCase(repository);

		const result = await useCase.execute({
			userId: "owner-1",
			engagementId: "engagement-1",
			page: 1,
			pageSize: 20,
			order: "desc",
		});

		expect(result.items[0].contact).toEqual({
			available: true,
			targetType: "assigned_seller",
			displayLabel: "Consultar responsable",
			whatsappPhone: "+5493512222222",
		});
	});

	// S-2: assigned seller has no phone; creator's phone is NOT used
	it("S-2: does not use creator phone when assigned seller has no phone", async () => {
		const engagement = makeEngagement({ id: "engagement-1" });
		const movement = makeMovement({
			id: "movement-1",
			propertyEngagementId: "engagement-1",
			createdBy: {
				id: "manager-1",
				email: "manager@example.com",
				firstName: "Manager",
				whatsappPhone: "+5493511111111",
			},
			propertyEngagement: {
				agents: [
					{
						agentUserId: "seller-1",
						assignedAt: new Date("2024-01-01T00:00:00.000Z"),
						agentUser: { whatsappPhone: null },
					},
				],
			},
		});
		const repository = makeRepository({
			findEngagementTimelineForOwner: vi
				.fn()
				.mockResolvedValue({ engagement, items: [movement], total: 1 }),
		});
		const useCase = new GetOwnerEngagementTimelineUseCase(repository);

		const result = await useCase.execute({
			userId: "owner-1",
			engagementId: "engagement-1",
			page: 1,
			pageSize: 20,
			order: "desc",
		});

		expect(result.items[0].contact).toEqual({
			available: false,
			targetType: "assigned_seller",
			displayLabel: "Contacto no configurado",
		});
		expect(result.items[0].contact).not.toHaveProperty("whatsappPhone");
	});

	// S-3: two sellers; earliest assignedAt wins and has a phone
	it("S-3: picks the seller with the earliest assignedAt when two sellers exist", async () => {
		const engagement = makeEngagement({ id: "engagement-1" });
		const movement = makeMovement({
			id: "movement-1",
			propertyEngagementId: "engagement-1",
			propertyEngagement: {
				agents: [
					// agents[0] is earliest (SQL-sorted by assignedAt asc)
					{
						agentUserId: "seller-a",
						assignedAt: new Date("2024-01-01T00:00:00.000Z"),
						agentUser: { whatsappPhone: "+5493512222222" },
					},
					{
						agentUserId: "seller-b",
						assignedAt: new Date("2024-06-01T00:00:00.000Z"),
						agentUser: { whatsappPhone: "+5493511111111" },
					},
				],
			},
		});
		const repository = makeRepository({
			findEngagementTimelineForOwner: vi
				.fn()
				.mockResolvedValue({ engagement, items: [movement], total: 1 }),
		});
		const useCase = new GetOwnerEngagementTimelineUseCase(repository);

		const result = await useCase.execute({
			userId: "owner-1",
			engagementId: "engagement-1",
			page: 1,
			pageSize: 20,
			order: "desc",
		});

		expect(result.items[0].contact).toEqual({
			available: true,
			targetType: "assigned_seller",
			displayLabel: "Consultar responsable",
			whatsappPhone: "+5493512222222",
		});
	});

	// S-4: identical assignedAt; agentUserId ascending tie-break
	it("S-4: breaks assignedAt tie by agentUserId ascending", async () => {
		const sharedAssignedAt = new Date("2024-03-15T00:00:00.000Z");
		const engagement = makeEngagement({ id: "engagement-1" });
		const movement = makeMovement({
			id: "movement-1",
			propertyEngagementId: "engagement-1",
			propertyEngagement: {
				agents: [
					// agents[0] wins: 'user-aaa' < 'user-bbb' (SQL-sorted by agentUserId asc)
					{
						agentUserId: "user-aaa",
						assignedAt: sharedAssignedAt,
						agentUser: { whatsappPhone: "+5493512222222" },
					},
					{
						agentUserId: "user-bbb",
						assignedAt: sharedAssignedAt,
						agentUser: { whatsappPhone: "+5493511111111" },
					},
				],
			},
		});
		const repository = makeRepository({
			findEngagementTimelineForOwner: vi
				.fn()
				.mockResolvedValue({ engagement, items: [movement], total: 1 }),
		});
		const useCase = new GetOwnerEngagementTimelineUseCase(repository);

		const result = await useCase.execute({
			userId: "owner-1",
			engagementId: "engagement-1",
			page: 1,
			pageSize: 20,
			order: "desc",
		});

		expect(result.items[0].contact).toEqual({
			available: true,
			targetType: "assigned_seller",
			displayLabel: "Consultar responsable",
			whatsappPhone: "+5493512222222",
		});
	});

	// S-5: zero assigned sellers → unavailable
	it("S-5: returns unavailable contact when no sellers are assigned", async () => {
		const engagement = makeEngagement({ id: "engagement-1" });
		const movement = makeMovement({
			id: "movement-1",
			propertyEngagementId: "engagement-1",
			propertyEngagement: { agents: [] },
		});
		const repository = makeRepository({
			findEngagementTimelineForOwner: vi
				.fn()
				.mockResolvedValue({ engagement, items: [movement], total: 1 }),
		});
		const useCase = new GetOwnerEngagementTimelineUseCase(repository);

		const result = await useCase.execute({
			userId: "owner-1",
			engagementId: "engagement-1",
			page: 1,
			pageSize: 20,
			order: "desc",
		});

		expect(result.items[0].contact).toEqual({
			available: false,
			targetType: "assigned_seller",
			displayLabel: "Contacto no configurado",
		});
	});

	// S-6: assigned seller has 7-digit phone (below MIN_WHATSAPP_DIGITS threshold of 8)
	it("S-6: returns unavailable contact when assigned seller phone has fewer than 8 digits", async () => {
		const engagement = makeEngagement({ id: "engagement-1" });
		const movement = makeMovement({
			id: "movement-1",
			propertyEngagementId: "engagement-1",
			propertyEngagement: {
				agents: [
					{
						agentUserId: "seller-1",
						assignedAt: new Date("2024-01-01T00:00:00.000Z"),
						// '+111234567' strips to '111234567' = 9 digits - use '1234567' (7 digits) instead
						agentUser: { whatsappPhone: "1234567" },
					},
				],
			},
		});
		const repository = makeRepository({
			findEngagementTimelineForOwner: vi
				.fn()
				.mockResolvedValue({ engagement, items: [movement], total: 1 }),
		});
		const useCase = new GetOwnerEngagementTimelineUseCase(repository);

		const result = await useCase.execute({
			userId: "owner-1",
			engagementId: "engagement-1",
			page: 1,
			pageSize: 20,
			order: "desc",
		});

		expect(result.items[0].contact).toEqual({
			available: false,
			targetType: "assigned_seller",
			displayLabel: "Contacto no configurado",
		});
	});

	// S-7: valid phone produces correct targetType, displayLabel and whatsappPhone
	it("S-7: resolves correct targetType and displayLabel for valid assigned seller phone", async () => {
		const engagement = makeEngagement({ id: "engagement-1" });
		const movement = makeMovement({
			id: "movement-1",
			propertyEngagementId: "engagement-1",
			propertyEngagement: {
				agents: [
					{
						agentUserId: "seller-1",
						assignedAt: new Date("2024-01-01T00:00:00.000Z"),
						agentUser: { whatsappPhone: "+5493512222222" },
					},
				],
			},
		});
		const repository = makeRepository({
			findEngagementTimelineForOwner: vi
				.fn()
				.mockResolvedValue({ engagement, items: [movement], total: 1 }),
		});
		const useCase = new GetOwnerEngagementTimelineUseCase(repository);

		const result = await useCase.execute({
			userId: "owner-1",
			engagementId: "engagement-1",
			page: 1,
			pageSize: 20,
			order: "desc",
		});

		expect(result.items[0].contact).toEqual({
			available: true,
			targetType: "assigned_seller",
			displayLabel: "Consultar responsable",
			whatsappPhone: "+5493512222222",
		});
	});

	// S-8: property-level Contactar inmobiliaria is unchanged (regression guard)
	it("S-8: property-level tenant contact resolves via mapTenantWhatsappContact with targetType tenant", async () => {
		const property = makeProperty({ id: "property-1" });
		const engagement = makeEngagement({
			id: "engagement-1",
			propertyAssetId: "property-1",
			tenant: {
				id: "tenant-1",
				name: "Acme Realty",
				whatsappPhone: "+5493510000000",
			},
		});
		const repository = makeRepository({
			findPropertyByOwner: vi.fn().mockResolvedValue(property),
			findEngagementsForOwnerProperty: vi.fn().mockResolvedValue([engagement]),
		});
		const useCase = new ListOwnerPropertyEngagementsUseCase(repository);

		const result = await useCase.execute({
			userId: "owner-1",
			propertyAssetId: "property-1",
		});

		expect(result[0].contact).toEqual({
			available: true,
			targetType: "tenant",
			displayLabel: "Contactar inmobiliaria",
			whatsappPhone: "+5493510000000",
		});
	});

	// S-9: tracking use case writes metadata.targetType: 'assigned_seller'
	it("S-9: track-owner-movement-whatsapp-contact-click emits assigned_seller in analytics metadata", async () => {
		const repository = makeRepository({
			findMovementContactContextForOwner: vi.fn().mockResolvedValue({
				id: "movement-1",
				tenantId: "tenant-1",
				propertyEngagementId: "engagement-1",
				propertyAssetId: "property-1",
			}),
		});
		const analyticsService = {
			track: vi.fn().mockResolvedValue({ status: "persisted" }),
		};
		const useCase = new TrackOwnerMovementWhatsappContactClickUseCase(
			repository,
			analyticsService as never,
		);

		await useCase.execute({
			userId: "owner-1",
			engagementId: "engagement-1",
			movementId: "movement-1",
		});

		expect(analyticsService.track).toHaveBeenCalledWith(
			expect.objectContaining({
				metadata: { context: "movement", targetType: "assigned_seller" },
			}),
		);
	});
});

function makeRepository(
	overrides: Partial<OwnerPortalRepository>,
): OwnerPortalRepository {
	return {
		findPropertiesByOwnerUserId: vi.fn(),
		findPropertyByOwner: vi.fn(),
		findEngagementsForOwnerProperty: vi.fn(),
		findEngagementTimelineForOwner: vi.fn(),
		findEngagementContactContextForOwner: vi.fn(),
		findMovementContactContextForOwner: vi.fn(),
		...overrides,
	};
}

function makeProperty(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: "property-1",
		title: "Owned apartment",
		addressLine: "Av. Corrientes 1234",
		city: "Buenos Aires",
		province: "CABA",
		propertyType: "APARTMENT",
		totalAreaSqm: null,
		coveredAreaSqm: null,
		rooms: null,
		bedrooms: null,
		bathrooms: null,
		garages: null,
		ageYears: null,
		orientation: null,
		images: [],
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-02T00:00:00.000Z"),
		...overrides,
	} as never;
}

function makeEngagement(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: "engagement-1",
		propertyAssetId: "property-1",
		operationType: "SALE",
		status: "ACTIVE_PUBLICATION",
		publishedPriceCents: 120_000_00,
		currency: "USD",
		tenant: { id: "tenant-1", name: "Acme Realty", whatsappPhone: null },
		agents: [
			{
				agentUserId: "agent-1",
				agentUser: { firstName: "Ada", email: "ada@example.com" },
			},
		],
		createdAt: new Date("2026-01-03T00:00:00.000Z"),
		updatedAt: new Date("2026-01-04T00:00:00.000Z"),
		...overrides,
	} as never;
}

function makeMovement(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: "movement-1",
		propertyEngagementId: "engagement-1",
		type: "GENERAL_UPDATE",
		observation: "Listing refreshed.",
		nextStep: "Send report",
		previousStatus: null,
		newStatus: null,
		source: "MANUAL",
		interestCount: 3,
		visitCount: 1,
		offerAmountCents: null,
		interestLevel: "HIGH",
		createdBy: {
			id: "agent-1",
			email: "ada@example.com",
			firstName: "Ada",
			whatsappPhone: null,
		},
		propertyEngagement: {
			agents: [] as Array<{
				agentUserId: string;
				assignedAt: Date;
				agentUser: { whatsappPhone: string | null };
			}>,
		},
		createdAt: new Date("2026-01-05T00:00:00.000Z"),
		...overrides,
	} as never;
}
