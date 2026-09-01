import { PropertyAssetOwnerAccessStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { PrismaOwnerPortalRepository } from "../src/owner-portal/prisma-owner-portal.repository";
import { mapOwnerEngagement } from "../src/owner-portal/responses/owner-engagement.response";
import { mapOwnerMovement } from "../src/owner-portal/responses/owner-movement.response";
import { mapOwnerProperty } from "../src/owner-portal/responses/owner-property.response";

describe("Owner portal repository", () => {
	it("exposes owner access statuses from Prisma Client", () => {
		expect(PropertyAssetOwnerAccessStatus.ACTIVE).toBe("ACTIVE");
		expect(PropertyAssetOwnerAccessStatus.REVOKED).toBe("REVOKED");
	});

	it("active owner sees owned property without owner-list data", async () => {
		const property = makeProperty({
			id: "property-1",
			title: "Owned apartment",
		});
		const findMany = vi.fn().mockResolvedValue([property]);
		const repository = new PrismaOwnerPortalRepository({
			propertyAsset: { findMany },
		} as never);

		const result = await repository.findPropertiesByOwnerUserId("owner-1");

		expect(result).toEqual([property]);
		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					owners: { some: { userId: "owner-1", accessStatus: "ACTIVE" } },
				},
			}),
		);
		expect(mapOwnerProperty(result[0])).toEqual({
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
			primaryImage: null,
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-02T00:00:00.000Z",
		});
	});

	it("revoked owner does not see property", async () => {
		const findFirst = vi.fn().mockResolvedValue(null);
		const repository = new PrismaOwnerPortalRepository({
			propertyAsset: { findFirst },
		} as never);

		const result = await repository.findPropertyByOwner({
			userId: "owner-1",
			propertyAssetId: "property-1",
		});

		expect(result).toBeNull();
		expect(findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					id: "property-1",
					owners: { some: { userId: "owner-1", accessStatus: "ACTIVE" } },
				},
			}),
		);
	});

	it("owner does not see another owner property", async () => {
		const findMany = vi.fn().mockResolvedValue([]);
		const repository = new PrismaOwnerPortalRepository({
			propertyAsset: { findMany },
		} as never);

		const result = await repository.findPropertiesByOwnerUserId("other-owner");

		expect(result).toEqual([]);
		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					owners: { some: { userId: "other-owner", accessStatus: "ACTIVE" } },
				},
			}),
		);
	});

	it("owner can fetch engagements for owned property with sanitized tenant and agent data", async () => {
		const engagement = makeEngagement({
			id: "engagement-1",
			propertyAssetId: "property-1",
		});
		const findMany = vi.fn().mockResolvedValue([engagement]);
		const repository = new PrismaOwnerPortalRepository({
			propertyEngagement: { findMany },
		} as never);

		const result = await repository.findEngagementsForOwnerProperty({
			userId: "owner-1",
			propertyAssetId: "property-1",
		});

		expect(result).toEqual([engagement]);
		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					propertyAssetId: "property-1",
					propertyAsset: {
						owners: { some: { userId: "owner-1", accessStatus: "ACTIVE" } },
					},
				},
			}),
		);
		expect(mapOwnerEngagement(result[0])).toEqual({
			id: "engagement-1",
			tenant: { id: "tenant-1", name: "Acme Realty" },
			contact: {
				available: false,
				targetType: "tenant",
				displayLabel: "Contacto no configurado",
			},
			operationType: "SALE",
			status: "ACTIVE_PUBLICATION",
			publishedPriceCents: 120_000_00,
			currency: "USD",
			agents: [
				{ userId: "agent-1", firstName: "Ada", email: "ada@example.com" },
			],
			createdAt: "2026-01-03T00:00:00.000Z",
			updatedAt: "2026-01-04T00:00:00.000Z",
		});
	});

	it("maps tenant WhatsApp contact without leaking it through tenant", async () => {
		const engagement = makeEngagement({
			id: "engagement-1",
			propertyAssetId: "property-1",
			tenant: {
				id: "tenant-1",
				name: "Acme Realty",
				whatsappPhone: "+5493510000000",
			},
		});
		const findMany = vi.fn().mockResolvedValue([engagement]);
		const repository = new PrismaOwnerPortalRepository({
			propertyEngagement: { findMany },
		} as never);

		const result = await repository.findEngagementsForOwnerProperty({
			userId: "owner-1",
			propertyAssetId: "property-1",
		});
		const response = mapOwnerEngagement(result[0]);

		expect(response.tenant).toEqual({ id: "tenant-1", name: "Acme Realty" });
		expect(response.tenant).not.toHaveProperty("whatsappPhone");
		expect(response.contact).toEqual({
			available: true,
			targetType: "tenant",
			displayLabel: "Contactar inmobiliaria",
			whatsappPhone: "+5493510000000",
		});
	});

	it("finds owner-authorized engagement contact context", async () => {
		const findFirst = vi.fn().mockResolvedValue({
			id: "engagement-1",
			tenantId: "tenant-1",
			propertyAssetId: "property-1",
		});
		const repository = new PrismaOwnerPortalRepository({
			propertyEngagement: { findFirst },
		} as never);

		const result = await repository.findEngagementContactContextForOwner({
			userId: "owner-1",
			engagementId: "engagement-1",
		});

		expect(result).toEqual({
			id: "engagement-1",
			tenantId: "tenant-1",
			propertyAssetId: "property-1",
		});
		expect(findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					id: "engagement-1",
					propertyAsset: {
						owners: { some: { userId: "owner-1", accessStatus: "ACTIVE" } },
					},
				},
				select: { id: true, tenantId: true, propertyAssetId: true },
			}),
		);
	});

	it("finds owner-authorized movement contact context", async () => {
		const findFirst = vi.fn().mockResolvedValue({
			id: "movement-1",
			tenantId: "tenant-1",
			propertyEngagementId: "engagement-1",
			propertyEngagement: { propertyAssetId: "property-1" },
		});
		const repository = new PrismaOwnerPortalRepository({
			movement: { findFirst },
		} as never);

		const result = await repository.findMovementContactContextForOwner({
			userId: "owner-1",
			engagementId: "engagement-1",
			movementId: "movement-1",
		});

		expect(result).toEqual({
			id: "movement-1",
			tenantId: "tenant-1",
			propertyEngagementId: "engagement-1",
			propertyAssetId: "property-1",
		});
		expect(findFirst).toHaveBeenCalledWith({
			where: {
				id: "movement-1",
				propertyEngagementId: "engagement-1",
				propertyEngagement: {
					propertyAsset: {
						owners: { some: { userId: "owner-1", accessStatus: "ACTIVE" } },
					},
				},
			},
			select: {
				id: true,
				tenantId: true,
				propertyEngagementId: true,
				propertyEngagement: { select: { propertyAssetId: true } },
			},
		});
	});

	it("returns null for inaccessible movement contact context", async () => {
		const findFirst = vi.fn().mockResolvedValue(null);
		const repository = new PrismaOwnerPortalRepository({
			movement: { findFirst },
		} as never);

		const result = await repository.findMovementContactContextForOwner({
			userId: "owner-2",
			engagementId: "engagement-1",
			movementId: "movement-1",
		});

		expect(result).toBeNull();
		expect(findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					id: "movement-1",
					propertyEngagementId: "engagement-1",
					propertyEngagement: {
						propertyAsset: {
							owners: { some: { userId: "owner-2", accessStatus: "ACTIVE" } },
						},
					},
				}),
			}),
		);
	});

	it("timeline is available only for owned engagement", async () => {
		const engagement = makeEngagement({
			id: "engagement-1",
			propertyAssetId: "property-1",
		});
		const movement = makeMovement({
			id: "movement-1",
			propertyEngagementId: "engagement-1",
		});
		const findFirst = vi
			.fn()
			.mockResolvedValueOnce(engagement)
			.mockResolvedValueOnce(null);
		const findMany = vi.fn().mockResolvedValue([movement]);
		const count = vi.fn().mockResolvedValue(1);
		const primaryFindFirst = vi.fn().mockResolvedValue(null);
		const repository = new PrismaOwnerPortalRepository({
			propertyEngagement: { findFirst },
			movement: { findMany, count },
			propertyAgent: { findFirst: primaryFindFirst },
		} as never);

		const visible = await repository.findEngagementTimelineForOwner({
			userId: "owner-1",
			engagementId: "engagement-1",
			page: 2,
			pageSize: 10,
			order: "asc",
		});
		const hidden = await repository.findEngagementTimelineForOwner({
			userId: "owner-2",
			engagementId: "engagement-1",
			page: 1,
			pageSize: 10,
			order: "desc",
		});

		expect(visible).toEqual({ engagement, items: [movement], total: 1, primarySellerContact: null });
		expect(hidden).toEqual({ engagement: null, items: [], total: 0, primarySellerContact: null });
		expect(findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					id: "engagement-1",
					propertyAsset: {
						owners: { some: { userId: "owner-1", accessStatus: "ACTIVE" } },
					},
				},
			}),
		);
		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { propertyEngagementId: "engagement-1" },
				orderBy: { createdAt: "asc" },
				skip: 10,
				take: 10,
			}),
		);
		expect(count).toHaveBeenCalledWith({
			where: { propertyEngagementId: "engagement-1" },
		});
		expect(primaryFindFirst).toHaveBeenCalledTimes(1);
		expect(mapOwnerMovement(visible.items[0], null)).toEqual({
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
			createdBy: { id: "agent-1", email: "ada@example.com", firstName: "Ada" },
			contact: {
				available: false,
				targetType: "assigned_seller",
				displayLabel: "Contacto no configurado",
			},
			createdAt: "2026-01-05T00:00:00.000Z",
		});
	});


	it("loads one valid primary candidate for the owner-authorized page and reuses it for every movement", async () => {
		const engagement = makeEngagement({ id: "engagement-1", tenantId: "tenant-1" });
		const movements = [makeMovement({ id: "movement-1" }), makeMovement({ id: "movement-2" })];
		const candidate = {
			id: "assignment-primary",
			agentUserId: "seller-primary",
			agentUser: { whatsappPhone: "+5493512222222" },
		};
		const engagementFindFirst = vi.fn().mockResolvedValueOnce(engagement).mockResolvedValueOnce(null);
		const findMany = vi.fn().mockResolvedValue(movements);
		const count = vi.fn().mockResolvedValue(2);
		const primaryFindFirst = vi.fn().mockResolvedValue(candidate);
		const repository = new PrismaOwnerPortalRepository({
			propertyEngagement: { findFirst: engagementFindFirst },
			movement: { findMany, count },
			propertyAgent: { findFirst: primaryFindFirst },
		} as never);

		const visible = await repository.findEngagementTimelineForOwner({
			userId: "owner-1", engagementId: "engagement-1", page: 1, pageSize: 20, order: "desc",
		});
		const hidden = await repository.findEngagementTimelineForOwner({
			userId: "owner-2", engagementId: "engagement-1", page: 1, pageSize: 20, order: "desc",
		});

		expect(visible).toEqual({ engagement, items: movements, total: 2, primarySellerContact: candidate });
		expect(primaryFindFirst).toHaveBeenCalledTimes(1);
		expect(primaryFindFirst).toHaveBeenCalledWith({
			where: {
				tenantId: "tenant-1",
				propertyEngagementId: "engagement-1",
				isPrimary: true,
				agentUser: {
					status: "ACTIVE",
					memberships: { some: { tenantId: "tenant-1", status: "ACTIVE", role: "AGENT" } },
				},
			},
			select: { id: true, agentUserId: true, agentUser: { select: { whatsappPhone: true } } },
		});
		expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
			include: { createdBy: { select: { id: true, email: true, firstName: true } } },
		}));
		expect(hidden).toEqual({ engagement: null, items: [], total: 0, primarySellerContact: null });
		expect(primaryFindFirst).toHaveBeenCalledTimes(1);
		expect(findMany).toHaveBeenCalledTimes(1);
		expect(count).toHaveBeenCalledTimes(1);
	});

	it("maps a candidate phone but fails closed for null or unusable primary phones", () => {
		const movement = makeMovement();
		expect(mapOwnerMovement(movement as never, {
			id: "assignment-primary", agentUserId: "seller-primary", agentUser: { whatsappPhone: "+5493512222222" },
		})).toMatchObject({ contact: { available: true, targetType: "assigned_seller", displayLabel: "Consultar responsable", whatsappPhone: "+5493512222222" } });
		expect(mapOwnerMovement(movement as never, {
			id: "assignment-primary", agentUserId: "seller-primary", agentUser: { whatsappPhone: "1234567" },
		})).toEqual(expect.objectContaining({
			contact: { available: false, targetType: "assigned_seller", displayLabel: "Contacto no configurado" },
		}));
	});
	});
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
	};
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
	};
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
	};
}
