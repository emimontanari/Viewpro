import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { AnalyticsActorType, AnalyticsEventName, MovementSource, MovementType } from '@prisma/client'
import type { CurrentUser } from '../../auth/types/current-user'
import { NotificationProducerService } from '../../notifications/notification-producer.service'
import { PrismaService } from '../../database/prisma.service'
import { AnalyticsService } from '../../analytics/analytics.service'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { mapStatusChangeRequest, type StatusChangeRequestResponse } from '../responses/status-change-request.response'
import { buildMovementCreatePayload } from '../../movements/use-cases/build-movement-create-payload'
import type { CreateMovementDto } from '../../movements/dto/create-movement.dto'

@Injectable()
export class ApproveStatusChangeRequestUseCase {
  private readonly logger = new Logger(ApproveStatusChangeRequestUseCase.name)

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(NotificationProducerService)
    private readonly notificationProducer: NotificationProducerService,
    @Inject(AnalyticsService)
    private readonly analyticsService: AnalyticsService,
  ) {}

  async execute(
    tenant: TenantContext,
    currentUser: CurrentUser,
    requestId: string,
  ): Promise<StatusChangeRequestResponse> {
    const { resolved, movement } = await this.prisma.$transaction(async (tx) => {
      // Step 1: Acquire row-level lock (R1 strategy — FOR UPDATE via $queryRaw)
      // If the row doesn't exist or belongs to another tenant → 404.
      const locked = await tx.$queryRaw<
        Array<{ id: string; status: string; tenantId: string }>
      >`SELECT id, status, "tenantId" FROM status_change_requests WHERE id = ${requestId} AND "tenantId" = ${tenant.tenantId} FOR UPDATE`

      if (locked.length === 0) {
        throw new NotFoundException('Status change request not found')
      }

      // Step 2: Reload the request via Prisma now that the row is locked
      const request = await tx.statusChangeRequest.findUnique({ where: { id: requestId } })
      if (!request) {
        throw new NotFoundException('Status change request not found')
      }

      /**
       * Step 3: Self-approval guard (R5 strategy — identity-based, not role-based).
       *
       * This check uses `currentUser.id` — the authenticated user ID resolved by the
       * TenantMembershipGuard per request — and compares it against
       * `request.requestedByUserId`, the ID stored at request-creation time.
       *
       * Assumption: `currentUser.id` is stable across the lifetime of a request.
       * It is set once at user registration (UUID), never changes, and cannot be
       * spoofed by switching tenant context (the guard resolves it from the JWT sub claim).
       *
       * This means a user who holds BOTH AGENT and MANAGER memberships on the same
       * tenant is still blocked from approving their own request, regardless of
       * which role was used to authenticate (FR-16, S-6).
       *
       * See also: R5 strategy in design.md.
       */
      if (request.requestedByUserId === currentUser.id) {
        throw new ForbiddenException({
          errorCode: 'SELF_APPROVAL_FORBIDDEN',
          message: 'You cannot approve your own status change request.',
        })
      }

      // Step 4: Already-resolved guard (FR-15 — protects against the race loser)
      if (request.status !== 'PENDING') {
        throw new ConflictException({
          errorCode: 'STATUS_CHANGE_REQUEST_ALREADY_RESOLVED',
          message: 'This status change request has already been resolved.',
        })
      }

      // Step 5: Load engagement
      const engagement = await tx.propertyEngagement.findFirst({
        where: { id: request.propertyEngagementId, tenantId: tenant.tenantId },
      })
      if (!engagement) {
        throw new NotFoundException('Property engagement not found')
      }

      // Archived guard (FR-24)
      if (engagement.archivedAt) {
        throw new UnprocessableEntityException({
          errorCode: 'ENGAGEMENT_ARCHIVED',
          message: 'Cannot approve a status change request for an archived engagement.',
        })
      }

      // Step 6: Stale-state guard (FR-14)
      if (engagement.status !== request.currentStatusSnapshot) {
        throw new ConflictException({
          errorCode: 'STATUS_CHANGE_REQUEST_SUPERSEDED',
          message:
            'The property status has changed since this request was created. The request is now stale and cannot be approved.',
        })
      }

      // Step 7: Update PropertyEngagement.status (FR-12a)
      await tx.propertyEngagement.update({
        where: { id: engagement.id },
        data: { status: request.targetStatus },
      })

      // Step 8: Build + insert STATUS_CHANGE movement (FR-12b, FR-13)
      // Uses 20.13 pure builder — outcome fields will be null (FR-13 mutual exclusion).
      const { movementData } = buildMovementCreatePayload({
        tenantId: tenant.tenantId,
        propertyEngagementId: engagement.id,
        createdByUserId: request.requestedByUserId, // original seller, per FR-12
        engagementCurrentStatus: engagement.status, // pre-update value
        dto: {
          type: MovementType.STATUS_CHANGE,
          observation: 'State change approved',
          newStatus: request.targetStatus,
        } as CreateMovementDto,
      })

      const movement = await tx.movement.create({
        data: {
          ...movementData,
          source: MovementSource.SYSTEM,
        },
      })

      // Step 9: Resolve the request (FR-12c)
      const resolved = await tx.statusChangeRequest.update({
        where: { id: request.id },
        data: {
          status: 'RESOLVED',
          resolvedByUserId: currentUser.id,
          resolvedAt: new Date(),
        },
      })

      // Step 10: Audit log (spec NF block)
      this.logger.log(
        `[StatusChangeRequest] ${request.id} → RESOLVED (approved) by ${currentUser.id} at ${new Date().toISOString()} engagementId=${engagement.id} tenantId=${tenant.tenantId}`,
      )

      return { resolved, movement }
    })

    // Post-transaction side effects — best-effort, failures must not roll back (FR-30, S-12)

    // FR-17: analytics event
    this.analyticsService
      .track({
        eventName: AnalyticsEventName.PROPERTY_STATUS_CHANGED,
        actorType: AnalyticsActorType.INTERNAL_USER,
        tenantId: tenant.tenantId,
        actorUserId: currentUser.id,
        propertyEngagementId: resolved.propertyEngagementId,
        movementId: movement.id,
        metadata: {
          previousStatus: resolved.currentStatusSnapshot,
          newStatus: resolved.targetStatus,
        },
      })
      .catch(() => {})

    // FR-27: notify the seller
    this.notificationProducer
      .notifyStatusChangeApproved({
        tenantId: tenant.tenantId,
        recipientUserId: resolved.requestedByUserId,
        propertyEngagementId: resolved.propertyEngagementId,
        targetStatus: resolved.targetStatus,
      })
      .catch((err) => {
        this.logger.warn(
          `Failed to send STATUS_CHANGE_APPROVED notification: ${err instanceof Error ? err.message : String(err)}`,
        )
      })

    return mapStatusChangeRequest(resolved)
  }
}
