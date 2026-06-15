import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { Prisma, TenantMembershipStatus, TenantRole } from '@prisma/client'
import type { CurrentUser } from '../../auth/types/current-user'
import { PrismaService } from '../../database/prisma.service'
import { NotificationProducerService } from '../../notifications/notification-producer.service'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import type { CreateStatusChangeRequestDto } from '../dto/create-status-change-request.dto'
import { STATUS_CHANGE_REQUEST_PENDING_UNIQUE_CONSTRAINT } from '../constants/db'
import { isPartialUniqueViolation } from '../helpers/is-partial-unique-violation'
import {
  STATUS_CHANGE_REQUESTS_REPOSITORY,
  type StatusChangeRequestsRepository,
} from '../status-change-requests.repository'
import { PROPERTY_ENGAGEMENTS_REPOSITORY } from '../../property-engagements/property-engagements.repository'
import { mapStatusChangeRequest, type StatusChangeRequestResponse } from '../responses/status-change-request.response'

/** Minimal shape the use case needs from PropertyEngagementsRepository */
type EngagementForCreate = {
  id: string
  tenantId: string
  status: string
  archivedAt: Date | null
  agents: Array<{ agentUserId: string }>
}

type EngagementsRepoPort = {
  findByIdForTenant(input: {
    tenantId: string
    engagementId: string
    userId: string
    canViewAll: boolean
  }): Promise<EngagementForCreate | null>
}

@Injectable()
export class CreateStatusChangeRequestUseCase {
  private readonly logger = new Logger(CreateStatusChangeRequestUseCase.name)

  constructor(
    @Inject(STATUS_CHANGE_REQUESTS_REPOSITORY)
    private readonly repo: StatusChangeRequestsRepository,
    @Inject(PROPERTY_ENGAGEMENTS_REPOSITORY)
    private readonly engagementsRepo: EngagementsRepoPort,
    @Inject(NotificationProducerService)
    private readonly notificationProducer: NotificationProducerService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    tenant: TenantContext,
    currentUser: CurrentUser,
    engagementId: string,
    dto: CreateStatusChangeRequestDto,
  ): Promise<StatusChangeRequestResponse> {
    // Load engagement with agents (needed for FR-3 assignment check)
    // canViewAll = false ensures only assigned sellers can see the engagement.
    const engagement = await this.engagementsRepo.findByIdForTenant({
      tenantId: tenant.tenantId,
      engagementId,
      userId: currentUser.id,
      canViewAll: false,
    })

    // FR-3 / S-11: If engagement is null with canViewAll=false, the seller either doesn't exist
    // in this tenant or is not assigned to this engagement. Surface as 403 to match
    // the existing guard pattern (no info leak about engagement existence for unassigned sellers).
    if (!engagement) {
      throw new ForbiddenException({
        errorCode: 'NOT_ASSIGNED_TO_ENGAGEMENT',
        message: 'You are not assigned to this property engagement.',
      })
    }

    // FR-3: seller must be assigned to the engagement via PropertyAgent
    const isAssigned = engagement.agents.some((a: { agentUserId: string }) => a.agentUserId === currentUser.id)
    if (!isAssigned) {
      throw new ForbiddenException({
        errorCode: 'NOT_ASSIGNED_TO_ENGAGEMENT',
        message: 'You are not assigned to this property engagement.',
      })
    }

    // FR-24: archived engagement guard
    if (engagement.archivedAt !== null) {
      throw new UnprocessableEntityException({
        errorCode: 'ENGAGEMENT_ARCHIVED',
        message: 'Cannot create a status change request for an archived engagement.',
      })
    }

    // FR-6: same-status guard
    if (dto.targetStatus === engagement.status) {
      throw new UnprocessableEntityException({
        errorCode: 'TARGET_STATUS_SAME_AS_CURRENT',
        message: 'The target status is the same as the current engagement status.',
      })
    }

    // Create the pending request — P2002 maps to 409 (FR-5 / R2 strategy)
    let record
    try {
      record = await this.repo.createPending({
        tenantId: tenant.tenantId,
        propertyEngagementId: engagementId,
        requestedByUserId: currentUser.id,
        targetStatus: dto.targetStatus,
        currentStatusSnapshot: dto.currentStatusSnapshot,
        requestNote: dto.requestNote ?? null,
      })
    } catch (err) {
      // Check both the explicit constraint name AND the column target as a fallback
      // (Prisma's P2002 meta shape varies across minor versions for partial indexes)
      const isDuplicate =
        isPartialUniqueViolation(err, STATUS_CHANGE_REQUEST_PENDING_UNIQUE_CONSTRAINT) ||
        (err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002' &&
          Array.isArray((err.meta as Record<string, unknown> | undefined)?.target) &&
          ((err.meta as Record<string, unknown>).target as string[]).includes('propertyEngagementId'))

      if (isDuplicate) {
        throw new ConflictException({
          errorCode: 'STATUS_CHANGE_REQUEST_ALREADY_PENDING',
          message: 'A pending status change request already exists for this property.',
        })
      }
      throw err
    }

    // Audit log (spec NF block)
    this.logger.log(
      `[StatusChangeRequest] ${record.id} → CREATED by ${currentUser.id} at ${new Date().toISOString()}`,
    )

    // After commit: notify managers (best-effort, FR-26, FR-30)
    this.notifyManagers({
      tenantId: tenant.tenantId,
      requestedByUserId: currentUser.id,
      propertyEngagementId: engagementId,
      targetStatus: dto.targetStatus,
    }).catch((err) => {
      this.logger.warn(
        `Failed to send STATUS_CHANGE_REQUESTED notification: ${err instanceof Error ? err.message : String(err)}`,
      )
    })

    return mapStatusChangeRequest(record)
  }

  private async notifyManagers(input: {
    tenantId: string
    requestedByUserId: string
    propertyEngagementId: string
    targetStatus: string
  }): Promise<void> {
    // Design §Producer call sites: query active managers excluding the requester (issue #7)
    const managers = await this.prisma.tenantMembership.findMany({
      where: {
        tenantId: input.tenantId,
        status: TenantMembershipStatus.ACTIVE,
        role: { in: [TenantRole.PRINCIPAL_MANAGER, TenantRole.MANAGER] },
        userId: { not: input.requestedByUserId },
      },
      select: { userId: true },
    })

    const recipientUserIds = [...new Set(managers.map((m) => m.userId))]

    await this.notificationProducer.notifyStatusChangeRequested({
      tenantId: input.tenantId,
      recipientUserIds,
      propertyEngagementId: input.propertyEngagementId,
      targetStatus: input.targetStatus,
      requestedByUserId: input.requestedByUserId,
    })
  }
}
