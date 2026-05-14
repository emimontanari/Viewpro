import type { Prisma, Tenant } from '@prisma/client'

export const TENANTS_REPOSITORY = Symbol('TENANTS_REPOSITORY')

export type TenantsRepository = {
  create(data: Prisma.TenantCreateInput): Promise<Tenant>
  findBySlug(slug: string): Promise<Tenant | null>
}
