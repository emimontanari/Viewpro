import { Inject, Injectable, UnprocessableEntityException } from '@nestjs/common'
import type { PlatformOperatorRole } from '@prisma-platform/client'
import { OPERATOR_REPOSITORY, type IOperatorRepository, type OperatorSummary } from '../../auth/repositories/operator.repository'
import { PrismaService } from '../../database/prisma.service'
import { AuditLogRepository } from '../../platform-data/audit-log.repository'
import { withLastOwnerGuard } from '../guards/last-owner-invariant'
import type { OperatorActor } from './create-operator.use-case'

const SELF_DEMOTE_RESPONSE = {
  statusCode: 422,
  code: 'SELF_DEMOTE_FORBIDDEN',
  message: 'You cannot change your own role',
}

/**
 * ChangeRoleOperatorUseCase (platform-operator-management, A4).
 *
 * Guard order: self-demote check (actor.id === targetId) FIRST, before any
 * DB read — then the race-safe last-OWNER invariant (Decision 2), applied
 * inside the SAME transaction as the role update (withLastOwnerGuard).
 */
@Injectable()
export class ChangeRoleOperatorUseCase {
  constructor(
    @Inject(OPERATOR_REPOSITORY) private readonly operatorRepository: IOperatorRepository,
    private readonly prisma: PrismaService,
    private readonly auditLogRepo: AuditLogRepository,
  ) {}

  async execute(targetId: string, newRole: PlatformOperatorRole, actor: OperatorActor): Promise<OperatorSummary> {
    if (actor.id === targetId) {
      throw new UnprocessableEntityException(SELF_DEMOTE_RESPONSE)
    }

    // Atomicity (JD FIX 1): the FOR-UPDATE guard, the role mutation, and the
    // native audit write all run in the SAME transaction (the one opened by
    // withLastOwnerGuard). If the audit write throws, the role change rolls
    // back — no silent audit gap on this highest-privilege action.
    return withLastOwnerGuard(this.prisma, targetId, async (tx) => {
      const updated = await this.operatorRepository.updateRole(targetId, newRole, tx)

      await this.auditLogRepo.appendNative(
        {
          action: 'OPERATOR_ROLE_CHANGED',
          actor,
          target: { id: updated.id, email: updated.email },
          newValue: { role: newRole },
        },
        tx,
      )

      return updated
    })
  }
}
