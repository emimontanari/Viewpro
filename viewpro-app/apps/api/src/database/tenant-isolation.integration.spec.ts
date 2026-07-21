import { Test, type TestingModule } from "@nestjs/testing";
import { ClsModule, ClsService } from "nestjs-cls";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConfigModule } from "../config/config.module";
import { TENANT_ID_CLS_KEY } from "../tenant-context/tenant-context.store";
import { DatabaseModule } from "./database.module";
import { PrismaService } from "./prisma.service";

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

	beforeAll(async () => {
		moduleRef = await Test.createTestingModule({
			imports: [ClsModule.forRoot({ global: true }), ConfigModule, DatabaseModule],
		}).compile();

		prisma = moduleRef.get(PrismaService);
		cls = moduleRef.get(ClsService);

		// No ALS context here → enforcement is skipped, so the seed spans tenants.
		await prisma.tenantMovementOutcomeLabel.deleteMany();
		await prisma.tenantMembership.deleteMany();
		await prisma.tenant.deleteMany();
		await prisma.user.deleteMany();

		const user = await prisma.user.create({
			data: { email: "isolation@test.local", passwordHash: "x", firstName: "Iso" },
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
		await prisma.tenantMovementOutcomeLabel.deleteMany();
		await prisma.tenant.deleteMany();
		await prisma.user.deleteMany();
		await moduleRef.close();
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
		).rejects.toThrow();
	});
});
