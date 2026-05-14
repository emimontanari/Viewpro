import { Injectable } from '@nestjs/common'
import type { Prisma, Tenant } from '@prisma/client'
import { PrismaService } from '../database/prisma.service'
import type { TenantsRepository } from './tenants.repository'

@Injectable()
export class PrismaTenantsRepository implements TenantsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.TenantCreateInput): Promise<Tenant> {
    return this.prisma.tenant.create({ data })
  }

  findBySlug(slug: string): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({ where: { slug } })
  }
}
