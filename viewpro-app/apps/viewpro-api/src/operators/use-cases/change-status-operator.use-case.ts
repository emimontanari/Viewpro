import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import type { OperatorStatus } from '@prisma-platform/client'
import { OPERATOR_REPOSITORY, type IOperatorRepository, type OperatorSummary } from '../../auth/repositories/operator.repository'
import { PrismaService } from '../../database/prisma.service'
import { AuditLogRepository } from '../../platform-data/audit-log.repository'
import { withLastOwnerGuard } from '../guards/last-owner-invariant'
import type { OperatorActor } from './create-operator.use-case'

const SELF_SUSPEND_RESPONSE = {
  statusCode: 422,
  code: 'SELF_STATUS_CHANGE_FORBIDDEN',
  message: 'You cannot change your own status',
}

const OPERATOR_NOT_FOUND_RESPONSE = {
  statusCode: 404,
  code: 'OPERATOR_NOT_FOUND',
  message: 'Operator not found',
}

/**
 * ChangeStatusOperatorUseCase (platform-operator-management, A4).
 *
 * Guard order: self-target check (actor.id === targetId) FIRST, before any
 * DB read — then the race-safe last-OWNER invariant (Decision 2), applied
 * inside the SAME transaction as the status update (withLastOwnerGuard).
 * Applies uniformly to suspend AND reactivate: reactivating never reduces the
 * ACTIVE-OWNER count, so the guard is a no-op false-positive-free check there.
 */
@Injectable()
export class ChangeStatusOperatorUseCase {
  constructor(
    @Inject(OPERATOR_REPOSITORY) private readonly operatorRepository: IOperatorRepository,
    private readonly prisma: PrismaService,
    private readonly auditLogRepo: AuditLogRepository,
  ) {}

  async execute(targetId: string, newStatus: OperatorStatus, actor: OperatorActor): Promise<OperatorSummary> {
    if (actor.id === targetId) {
      throw new UnprocessableEntityException(SELF_SUSPEND_RESPONSE)
    }

    // Not-found pre-check (JD FIX 2): 404 for a nonexistent target instead of
    // an unhandled Prisma P2025 → 500. Ordered AFTER the self-guard (422) and
    // BEFORE the last-OWNER transaction (422): 422 self → 404 not-found → 422
    // last-owner → mutate.
    const target = await this.operatorRepository.findById(targetId)
    if (!target) {
      throw new NotFoundException(OPERATOR_NOT_FOUND_RESPONSE)
    }

    // Atomicity (JD FIX 1): the FOR-UPDATE guard, the status mutation, and the
    // native audit write all run in the SAME transaction (the one opened by
    // withLastOwnerGuard). If the audit write throws, the status change rolls
    // back — no silent audit gap on this highest-privilege action.
    return withLastOwnerGuard(this.prisma, targetId, async (tx) => {
      const updated = await this.operatorRepository.updateStatus(targetId, newStatus, tx)

      await this.auditLogRepo.appendNative(
        {
          action: newStatus === 'SUSPENDED' ? 'OPERATOR_SUSPENDED' : 'OPERATOR_REACTIVATED',
          actor,
          target: { id: updated.id, email: updated.email },
        },
        tx,
      )

      return updated
    })
  }
}
