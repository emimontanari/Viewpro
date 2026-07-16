import { Inject, Injectable, UnprocessableEntityException } from '@nestjs/common'
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

    const updated = await withLastOwnerGuard(this.prisma, targetId, (tx) =>
      this.operatorRepository.updateStatus(targetId, newStatus, tx),
    )

    await this.auditLogRepo.appendNative({
      action: newStatus === 'SUSPENDED' ? 'OPERATOR_SUSPENDED' : 'OPERATOR_REACTIVATED',
      actor,
      target: { id: updated.id, email: updated.email },
    })

    return updated
  }
}
