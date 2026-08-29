import { Test, type TestingModule } from "@nestjs/testing";
import { ClsModule, ClsService } from "nestjs-cls";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConfigModule } from "../config/config.module";
import { TENANT_ID_CLS_KEY } from "../tenant-context/tenant-context.store";
import { DatabaseModule } from "./database.module";
import { PrismaService } from "./prisma.service";

/** Identifiers this suite owns. Every delete below is filtered by one of them. */
const FIXTURE_USER_EMAIL = "isolation@test.local";
const FIXTURE_TENANT_SLUGS = ["iso-a", "iso-b"];

/** A row this suite does not own, used to prove cleanup never reaches outside. */
const OUTSIDER_USER_EMAIL = "isolation-outsider@test.local";

/**
 * Proves the Phase 3a enforce actively blocks cross-tenant reads: with tenant A
 * active in the ALS, class-A queries never see tenant B's rows, even when the
 * repo forgets the tenantId filter or filters by another tenant's unique value.
 */
describe("tenant isolation enforcement (integration)", () => {
	let moduleRef: TestingModule;
	let prisma: PrismaService;
	let cls: ClsService;
	let tenantAId: string;
	let tenantBId: string;
	let labelAId: string;
	let labelBId: string;
	let outsiderUserId: string;
	let outsiderAssetId: string;

	/**
	 * Deletes only what this suite creates.
	 *
	 * An unfiltered deleteMany() would wipe the whole local database, and it
	 * breaks outright the moment any surviving row holds a non-cascading foreign
	 * key onto users — ten models carry one today, so naming them here would be a
	 * list that silently rots every time an eleventh is added. Filtering by the
	 * fixtures' own identity removes the dependency on what else the database
	 * happens to hold.
	 */
	async function deleteOwnFixtures() {
		const tenants = await prisma.tenant.findMany({
			where: { slug: { in: FIXTURE_TENANT_SLUGS } },
			select: { id: true },
		});
		const tenantIds = tenants.map((tenant) => tenant.id);

		if (tenantIds.length > 0) {
			await prisma.tenantMovementOutcomeLabel.deleteMany({
				where: { tenantId: { in: tenantIds } },
			});
			await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: tenantIds } } });
			await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
		}

		await prisma.user.deleteMany({ where: { email: FIXTURE_USER_EMAIL } });
	}

	beforeAll(async () => {
		moduleRef = await Test.createTestingModule({
			imports: [ClsModule.forRoot({ global: true }), ConfigModule, DatabaseModule],
		}).compile();

		prisma = moduleRef.get(PrismaService);
		cls = moduleRef.get(ClsService);

		// No ALS context anywhere in this hook → enforcement is skipped, so the
		// seed spans tenants.

		// Stand in for whatever unrelated data a developer's database already
		// holds. It is created before the cleanup runs so the assertion below is
		// about cleanup's reach, not about ordering.
		await prisma.propertyAsset.deleteMany({
			where: { createdBy: { email: OUTSIDER_USER_EMAIL } },
		});
		await prisma.user.deleteMany({ where: { email: OUTSIDER_USER_EMAIL } });
		const outsider = await prisma.user.create({
			data: { email: OUTSIDER_USER_EMAIL, passwordHash: "x", firstName: "Outsider" },
		});
		const outsiderAsset = await prisma.propertyAsset.create({
			data: {
				title: "Outsider asset",
				addressLine: "Calle 1",
				city: "CABA",
				province: "CABA",
				propertyType: "HOUSE",
				createdByUserId: outsider.id,
			},
		});
		outsiderUserId = outsider.id;
		outsiderAssetId = outsiderAsset.id;

		await deleteOwnFixtures();

		const user = await prisma.user.create({
			data: { email: FIXTURE_USER_EMAIL, passwordHash: "x", firstName: "Iso" },
		});
		const tenantA = await prisma.tenant.create({ data: { name: "A", slug: "iso-a" } });
		const tenantB = await prisma.tenant.create({ data: { name: "B", slug: "iso-b" } });
		tenantAId = tenantA.id;
		tenantBId = tenantB.id;

		const labelA = await prisma.tenantMovementOutcomeLabel.create({
			data: { tenantId: tenantAId, label: "label-A", createdByUserId: user.id },
		});
		const labelB = await prisma.tenantMovementOutcomeLabel.create({
			data: { tenantId: tenantBId, label: "label-B", createdByUserId: user.id },
		});
		labelAId = labelA.id;
		labelBId = labelB.id;
	});

	afterAll(async () => {
		await deleteOwnFixtures();
		await prisma.propertyAsset.deleteMany({ where: { id: outsiderAssetId } });
		await prisma.user.deleteMany({ where: { id: outsiderUserId } });
		await moduleRef.close();
	});

	it("setup cleanup leaves rows this suite does not own untouched", async () => {
		const outsiderUser = await prisma.user.findUnique({ where: { id: outsiderUserId } });
		const outsiderAsset = await prisma.propertyAsset.findUnique({
			where: { id: outsiderAssetId },
		});

		expect(outsiderUser?.email).toBe(OUTSIDER_USER_EMAIL);
		expect(outsiderAsset?.createdByUserId).toBe(outsiderUserId);
	});

	function inTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
		return cls.run(async () => {
			cls.set(TENANT_ID_CLS_KEY, tenantId);
			return await fn();
		});
	}

	it("findMany without a tenantId filter returns only the active tenant's rows", async () => {
		const rows = await inTenant(tenantAId, () =>
			prisma.tenantMovementOutcomeLabel.findMany(),
		);

		expect(rows).toHaveLength(1);
		expect(rows[0]?.tenantId).toBe(tenantAId);
		expect(rows[0]?.label).toBe("label-A");
	});

	it("cannot read another tenant's row even when filtering by its unique label", async () => {
		const rows = await inTenant(tenantAId, () =>
			prisma.tenantMovementOutcomeLabel.findMany({ where: { label: "label-B" } }),
		);

		expect(rows).toEqual([]);
	});

	it("count is scoped to the active tenant", async () => {
		const count = await inTenant(tenantBId, () =>
			prisma.tenantMovementOutcomeLabel.count(),
		);

		expect(count).toBe(1);
	});

	it("applies no scoping without a tenant context (bypass paths see everything)", async () => {
		const all = await prisma.tenantMovementOutcomeLabel.findMany();

		expect(all.length).toBeGreaterThanOrEqual(2);
	});

	it("findUnique of the active tenant's own row returns it", async () => {
		const row = await inTenant(tenantAId, () =>
			prisma.tenantMovementOutcomeLabel.findUnique({ where: { id: labelAId } }),
		);

		expect(row?.id).toBe(labelAId);
	});

	it("findUnique of another tenant's row by id returns null", async () => {
		const row = await inTenant(tenantAId, () =>
			prisma.tenantMovementOutcomeLabel.findUnique({ where: { id: labelBId } }),
		);

		expect(row).toBeNull();
	});

	it("findUnique of another tenant's row still returns null with a restrictive select", async () => {
		const row = await inTenant(tenantAId, () =>
			prisma.tenantMovementOutcomeLabel.findUnique({
				where: { id: labelBId },
				select: { id: true, label: true },
			}),
		);

		expect(row).toBeNull();
	});

	it("findUniqueOrThrow of another tenant's row throws (as not found)", async () => {
		await expect(
			inTenant(tenantAId, () =>
				prisma.tenantMovementOutcomeLabel.findUniqueOrThrow({ where: { id: labelBId } }),
			),
		).rejects.toThrow('No TenantMovementOutcomeLabel found');
	});

	it("cannot update another tenant's row by id (throws, no mutation)", async () => {
		await expect(
			inTenant(tenantAId, () =>
				prisma.tenantMovementOutcomeLabel.update({
					where: { id: labelBId },
					data: { label: "hijacked" },
				}),
			),
		).rejects.toThrow(/update\(\)/);

		const untouched = await prisma.tenantMovementOutcomeLabel.findUnique({
			where: { id: labelBId },
		});
		expect(untouched?.label).toBe("label-B");
	});

	it("cannot delete another tenant's row by id (throws, row survives)", async () => {
		await expect(
			inTenant(tenantAId, () =>
				prisma.tenantMovementOutcomeLabel.delete({ where: { id: labelBId } }),
			),
		).rejects.toThrow(/delete\(\)/);

		const survivor = await prisma.tenantMovementOutcomeLabel.findUnique({
			where: { id: labelBId },
		});
		expect(survivor?.id).toBe(labelBId);
	});
});
