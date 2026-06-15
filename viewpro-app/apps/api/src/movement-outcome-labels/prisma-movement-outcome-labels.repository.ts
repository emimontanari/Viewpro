import { Inject, Injectable } from '@nestjs/common'
import type { TenantMovementOutcomeLabel } from '@prisma/client'
import { PrismaService } from '../database/prisma.service'
import type {
  CreateLabelInput,
  FindActiveInput,
  FindByIdForTenantInput,
  FindManyLabelsInput,
  MovementOutcomeLabelsRepository,
  SoftDeleteInput,
} from './movement-outcome-labels.repository'

/**
 * Checks if a Prisma error is a P2002 unique constraint violation.
 */
function isPrismaP2002(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  )
}

@Injectable()
export class PrismaMovementOutcomeLabelsRepository implements MovementOutcomeLabelsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Creates a new label. On P2002 from the partial unique index, re-queries the active
   * label and returns it (idempotency strategy R2 — FR-13, S-3, S-12).
   * If the re-query finds nothing (soft-deleted same-name row exists), bubbles the error
   * so the use case can create a fresh row on the next attempt.
   */
  async create(input: CreateLabelInput): Promise<TenantMovementOutcomeLabel> {
    try {
      return await this.prisma.tenantMovementOutcomeLabel.create({
        data: {
          tenantId: input.tenantId,
          label: input.label,
          color: input.color ?? null,
          createdByUserId: input.createdByUserId,
        },
      })
    } catch (err) {
      if (isPrismaP2002(err)) {
        // The active partial unique index fired — re-query the active row.
        const existing = await this.prisma.tenantMovementOutcomeLabel.findFirst({
          where: {
            tenantId: input.tenantId,
            label: { equals: input.label, mode: 'insensitive' },
            deletedAt: null,
          },
        })
        if (existing) {
          return existing
        }
      }
      throw err
    }
  }

  async findMany(input: FindManyLabelsInput): Promise<TenantMovementOutcomeLabel[]> {
    return this.prisma.tenantMovementOutcomeLabel.findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.activeOnly ? { deletedAt: null } : {}),
      },
      orderBy: { label: 'asc' },
    })
  }

  async findByIdForTenant(input: FindByIdForTenantInput): Promise<TenantMovementOutcomeLabel | null> {
    return this.prisma.tenantMovementOutcomeLabel.findFirst({
      where: { id: input.id, tenantId: input.tenantId },
    })
  }

  async findActive(input: FindActiveInput): Promise<TenantMovementOutcomeLabel | null> {
    return this.prisma.tenantMovementOutcomeLabel.findFirst({
      where: {
        tenantId: input.tenantId,
        label: { equals: input.label, mode: 'insensitive' },
        deletedAt: null,
      },
    })
  }

  async softDelete(input: SoftDeleteInput): Promise<TenantMovementOutcomeLabel> {
    return this.prisma.tenantMovementOutcomeLabel.update({
      where: { id: input.id },
      data: { deletedAt: new Date() },
    })
  }
}
