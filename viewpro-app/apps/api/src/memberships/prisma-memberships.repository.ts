import { Injectable } from '@nestjs/common'
import type { Prisma, TenantMembership } from '@prisma/client'
import { PrismaService } from '../database/prisma.service'
import type { MembershipsRepository, MembershipWithTenant } from './memberships.repository'

@Injectable()
export class PrismaMembershipsRepository implements MembershipsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.TenantMembershipCreateInput): Promise<TenantMembership> {
    return this.prisma.tenantMembership.create({ data })
  }

  findManyByUserId(userId: string): Promise<MembershipWithTenant[]> {
    return this.prisma.tenantMembership.findMany({
      where: { userId },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    })
  }
}
