import { Injectable } from "@nestjs/common";
import type { Prisma, TenantMembership } from "@prisma/client";
// biome-ignore lint/style/useImportType: Nest dependency injection needs runtime metadata.
import { PrismaService } from "../database/prisma.service";
import type {
	MembershipsRepository,
	MembershipWithTenant,
	MembershipWithUserAndTenant,
} from "./memberships.repository";

@Injectable()
export class PrismaMembershipsRepository implements MembershipsRepository {
	constructor(private readonly prisma: PrismaService) {}

	create(data: Prisma.TenantMembershipCreateInput): Promise<TenantMembership> {
		return this.prisma.tenantMembership.create({ data });
	}

	findManyByUserId(userId: string): Promise<MembershipWithTenant[]> {
		return this.prisma.tenantMembership.findMany({
			where: { userId },
			include: { tenant: true },
			orderBy: { createdAt: "asc" },
		});
	}

	findActiveManyByUserId(userId: string): Promise<MembershipWithTenant[]> {
		return this.prisma.tenantMembership.findMany({
			where: { userId, status: "ACTIVE" },
			include: { tenant: true },
			orderBy: { createdAt: "asc" },
		});
	}

	findManyByTenantId(tenantId: string): Promise<MembershipWithUserAndTenant[]> {
		return this.prisma.tenantMembership.findMany({
			where: { tenantId },
			include: { user: true, tenant: true },
			orderBy: [{ status: "asc" }, { createdAt: "asc" }],
		});
	}

	findByIdForTenant(
		membershipId: string,
		tenantId: string,
	): Promise<MembershipWithUserAndTenant | null> {
		return this.prisma.tenantMembership.findFirst({
			where: { id: membershipId, tenantId },
			include: { user: true, tenant: true },
		});
	}

	findByUserIdAndTenantId(
		userId: string,
		tenantId: string,
	): Promise<MembershipWithUserAndTenant | null> {
		return this.prisma.tenantMembership.findUnique({
			where: { userId_tenantId: { userId, tenantId } },
			include: { user: true, tenant: true },
		});
	}

	findActiveByUserIdAndTenantId(
		userId: string,
		tenantId: string,
	): Promise<MembershipWithUserAndTenant | null> {
		return this.prisma.tenantMembership.findFirst({
			where: { userId, tenantId, status: "ACTIVE" },
			include: { user: true, tenant: true },
		});
	}

	async updateRoleForTenant(input: {
		membershipId: string;
		tenantId: string;
		role: "MANAGER" | "AGENT";
	}): Promise<MembershipWithUserAndTenant | null> {
		const updated = await this.prisma.tenantMembership.updateMany({
			where: {
				id: input.membershipId,
				tenantId: input.tenantId,
				status: "ACTIVE",
			},
			data: { role: input.role },
		});

		if (updated.count === 0) {
			return null;
		}

		return this.findByIdForTenant(input.membershipId, input.tenantId);
	}

	async deactivateForTenant(input: {
		membershipId: string;
		tenantId: string;
		actorUserId: string;
		now?: Date;
	}): Promise<MembershipWithUserAndTenant | null> {
		const updated = await this.prisma.tenantMembership.updateMany({
			where: {
				id: input.membershipId,
				tenantId: input.tenantId,
				status: "ACTIVE",
			},
			data: {
				status: "DEACTIVATED",
				deactivatedAt: input.now ?? new Date(),
				deactivatedByUserId: input.actorUserId,
			},
		});

		if (updated.count === 0) {
			return null;
		}

		return this.findByIdForTenant(input.membershipId, input.tenantId);
	}
}
