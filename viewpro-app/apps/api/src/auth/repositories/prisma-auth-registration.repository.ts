import { Injectable } from '@nestjs/common'
import type { TenantRole } from '@prisma/client'
import { PrismaService } from '../../database/prisma.service'
import { PlatformOutboxWriter } from '../../platform-data/platform-outbox-writer'
import { computeTrialEndsAt } from '../utils/trial'
import type {
  AuthRegistrationRepository,
  RegisteredTenantRecord,
  RegisterTenantRecordInput,
} from './auth-registration.repository'

@Injectable()
export class PrismaAuthRegistrationRepository implements AuthRegistrationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxWriter: PlatformOutboxWriter,
  ) {}

  async registerTenant(input: RegisterTenantRecordInput): Promise<RegisteredTenantRecord> {
    return this.prisma.$transaction(async (tx) => {
      // Single `now` capture, reused for trialEndsAt (create data + payload)
      // AND occurredAt below — keeps "persisted value === emitted value" as
      // one atomic invariant next to the outbox emit (design decision).
      const now = new Date()
      const trialEndsAt = computeTrialEndsAt(now)

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
          trialEndsAt,
          whatsappPhone: input.whatsappPhone,
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

      // A4: emit TENANT_REGISTERED inside the SAME $transaction after tenant.create.
      // The outbox row commits iff user + tenant + membership commit.
      // Rollback ⇒ no outbox row persisted (atomicity guarantee).
      await this.outboxWriter.emit(tx, {
        eventType: 'TENANT_REGISTERED',
        tenantId: tenant.id,
        payload: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          newStatus: tenant.status,
          limits: {
            maxUsers: tenant.maxUsers,
            maxActivePropertyEngagements: tenant.maxActivePropertyEngagements,
            maxDocumentsStorageMb: tenant.maxDocumentsStorageMb,
          },
          trialEndsAt: trialEndsAt.toISOString(),
        },
        occurredAt: now.toISOString(),
      })

      return { user, memberships: [membership] }
    })
  }
}
