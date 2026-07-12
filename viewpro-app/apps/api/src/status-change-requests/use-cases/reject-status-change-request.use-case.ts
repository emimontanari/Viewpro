import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import { NotificationProducerService } from '../../notifications/notification-producer.service'
import { PrismaService } from '../../database/prisma.service'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import type { RejectStatusChangeRequestDto } from '../dto/reject-status-change-request.dto'
import { mapStatusChangeRequest, type StatusChangeRequestResponse } from '../responses/status-change-request.response'

@Injectable()
export class RejectStatusChangeRequestUseCase {
  private readonly logger = new Logger(RejectStatusChangeRequestUseCase.name)

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(NotificationProducerService)
    private readonly notificationProducer: NotificationProducerService,
  ) {}

  async execute(
    tenant: TenantContext,
    currentUser: CurrentUser,
    requestId: string,
    dto: RejectStatusChangeRequestDto,
  ): Promise<StatusChangeRequestResponse> {
    // Guard: resolutionComment must be non-empty (FR-18)
    // The DTO @IsNotEmpty handles HTTP-layer validation; this guards use-case-direct calls.
    if (!dto.resolutionComment || dto.resolutionComment.trim().length === 0) {
      throw new BadRequestException({
        errorCode: 'RESOLUTION_COMMENT_REQUIRED',
        message: 'A resolution comment is required when rejecting a status change request.',
      })
    }

    const resolved = await this.prisma.$transaction(async (tx) => {
      // Step 1: Acquire row-level lock (same as approve)
      const locked = await tx.$queryRaw<
        Array<{ id: string; status: string; tenantId: string }>
      >`SELECT id, status, "tenantId" FROM status_change_requests WHERE id = ${requestId} AND "tenantId" = ${tenant.tenantId} FOR UPDATE`

      if (locked.length === 0) {
        throw new NotFoundException('Status change request not found')
      }

      // Step 2: Reload
      const request = await tx.statusChangeRequest.findUnique({ where: { id: requestId } })
      if (!request) {
        throw new NotFoundException('Status change request not found')
      }

      // Step 3: Self-rejection guard (FR-20 — same identity check as FR-16)
      if (request.requestedByUserId === currentUser.id) {
        throw new ForbiddenException({
          errorCode: 'SELF_APPROVAL_FORBIDDEN',
          message: 'You cannot reject your own status change request.',
        })
      }

      // Step 4: Already-resolved guard (FR-15)
      if (request.status !== 'PENDING') {
        throw new ConflictException({
          errorCode: 'STATUS_CHANGE_REQUEST_ALREADY_RESOLVED',
          message: 'This status change request has already been resolved.',
        })
      }

      // Step 5: Mark RESOLVED with resolutionComment (FR-19 — no status mutation, no movement)
      const resolved = await tx.statusChangeRequest.update({
        where: { id: request.id },
        data: {
          status: 'RESOLVED',
          resolvedByUserId: currentUser.id,
          resolvedAt: new Date(),
          resolutionComment: dto.resolutionComment,
        },
      })

      // Audit log
      this.logger.log(
        `[StatusChangeRequest] ${request.id} → RESOLVED (rejected) by ${currentUser.id} at ${new Date().toISOString()} tenantId=${tenant.tenantId}`,
      )

      return resolved
    })

    // Post-transaction: notify the seller (FR-28, FR-30 — best-effort)
    this.notificationProducer
      .notifyStatusChangeRejected({
        tenantId: tenant.tenantId,
        recipientUserId: resolved.requestedByUserId,
        propertyEngagementId: resolved.propertyEngagementId,
        resolutionComment: resolved.resolutionComment!,
      })
      .catch((err) => {
        this.logger.warn(
          `Failed to send STATUS_CHANGE_REJECTED notification: ${err instanceof Error ? err.message : String(err)}`,
        )
      })

    return mapStatusChangeRequest(resolved)
  }
}
