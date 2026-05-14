import { Injectable } from '@nestjs/common'
import type { TenantRole } from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'
import type {
  AuthRegistrationRepository,
  RegisteredTenantRecord,
  RegisterTenantRecordInput,
} from './auth-registration.repository'

@Injectable()
export class PrismaAuthRegistrationRepository implements AuthRegistrationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async registerTenant(input: RegisterTenantRecordInput): Promise<RegisteredTenantRecord> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
        },
      })

      const tenant = await tx.tenant.create({
        data: {
          name: input.tenantName,
          slug: input.tenantSlug,
        },
      })

      const membership = await tx.tenantMembership.create({
        data: {
          role: input.role as TenantRole,
          userId: user.id,
          tenantId: tenant.id,
        },
        include: { tenant: true },
      })

      return { user, memberships: [membership] }
    })
  }
}
