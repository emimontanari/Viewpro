import {
	AnalyticsActorType,
	AnalyticsEventName,
	GlobalRole,
	TenantMembershipStatus,
	TenantRole,
	TenantStatus,
	UserStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { LoginUseCase } from "../src/auth/use-cases/login.use-case";

const activeUser = {
	id: "user-1",
	email: "agent@example.com",
	passwordHash: "hashed-password",
	firstName: "Agent",
	lastName: "Example",
	status: UserStatus.ACTIVE,
	globalRole: GlobalRole.USER,
	emailVerifiedAt: null,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

const singleMembership = {
	id: "membership-1",
	userId: "user-1",
	tenantId: "tenant-1",
	role: TenantRole.AGENT,
	status: TenantMembershipStatus.ACTIVE,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	updatedAt: new Date("2026-01-02T00:00:00.000Z"),
	tenant: {
		id: "tenant-1",
		name: "Acme Realty",
		slug: "acme-realty",
		status: TenantStatus.ACTIVE,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-02T00:00:00.000Z"),
	},
};

describe("Auth use cases", () => {
	it("emits seller login analytics when login resolves to exactly one tenant membership", async () => {
		const analyticsService = {
			track: vi.fn().mockResolvedValue({ status: "persisted" }),
		};
		const useCase = makeLoginUseCase({
			analyticsService,
			memberships: [singleMembership],
		});

		const result = await useCase.execute({
			email: "Agent@Example.com",
			password: "correct-password",
		});

		expect(result.body.user.id).toBe("user-1");
		expect(analyticsService.track).toHaveBeenCalledWith({
			eventName: AnalyticsEventName.SELLER_LOGGED_IN,
			actorType: AnalyticsActorType.INTERNAL_USER,
			tenantId: "tenant-1",
			actorUserId: "user-1",
		});
	});

	it("skips seller login analytics when multiple tenant memberships make tenant context ambiguous", async () => {
		const analyticsService = {
			track: vi.fn().mockResolvedValue({ status: "persisted" }),
		};
		const useCase = makeLoginUseCase({
			analyticsService,
			memberships: [
				singleMembership,
				{
					...singleMembership,
					id: "membership-2",
					tenantId: "tenant-2",
					tenant: { ...singleMembership.tenant, id: "tenant-2" },
				},
			],
		});

		await expect(
			useCase.execute({
				email: "agent@example.com",
				password: "correct-password",
			}),
		).resolves.toMatchObject({
			body: { user: { id: "user-1" } },
		});
		expect(analyticsService.track).not.toHaveBeenCalled();
	});

	it("keeps login successful when seller login analytics fails", async () => {
		const analyticsService = {
			track: vi.fn().mockRejectedValue(new Error("analytics unavailable")),
		};
		const useCase = makeLoginUseCase({
			analyticsService,
			memberships: [singleMembership],
		});

		await expect(
			useCase.execute({
				email: "agent@example.com",
				password: "correct-password",
			}),
		).resolves.toMatchObject({
			body: { user: { id: "user-1" } },
		});
	});
});

function makeLoginUseCase(input: {
	analyticsService: { track: ReturnType<typeof vi.fn> };
	memberships: unknown[];
}) {
	return new LoginUseCase(
		{ findByEmail: vi.fn().mockResolvedValue(activeUser) } as never,
		{
			findActiveManyByUserId: vi.fn().mockResolvedValue(input.memberships),
		} as never,
		{ verify: vi.fn().mockResolvedValue(true) } as never,
		{ create: vi.fn().mockResolvedValue({}) } as never,
		{
			signAccessToken: vi.fn().mockResolvedValue("access-token"),
			generateRefreshToken: vi.fn().mockReturnValue("refresh-token"),
			hashRefreshToken: vi.fn().mockReturnValue("refresh-token-hash"),
			getRefreshTokenExpiresAt: vi
				.fn()
				.mockReturnValue(new Date("2026-02-01T00:00:00.000Z")),
		} as never,
		input.analyticsService as never,
		// #326: the session now reports whether this identity can also enter the
		// owner portal. These cases are about seller login analytics, so the
		// ordinary seller-only answer is the right default here.
		{
			hasActiveOwnerAccess: vi.fn().mockResolvedValue(input.hasOwnerAccess ?? false),
		} as never,
	);
}
