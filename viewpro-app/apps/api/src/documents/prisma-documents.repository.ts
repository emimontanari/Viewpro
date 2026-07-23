import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import {
  DocumentRequestStatus,
  DocumentVersionStatus,
  PropertyAssetOwnerAccessStatus,
  PropertyEngagementStatus,
  type Prisma,
} from '@prisma/client'
import { PrismaService } from '../database/prisma.service'
import {
  BYTES_PER_MIB,
  TENANT_DOCUMENT_STORAGE_LIMIT_EXCEEDED_MESSAGE,
} from '../tenant-limits/tenant-limit-enforcement.constants'
import type {
  ActivityDocumentRequestRecord,
  CreateDocumentRequestInput,
  CreatePendingDocumentVersionInput,
  DocumentRequestRecord,
  DocumentsRepository,
  DocumentVersionRecord,
  FindInternalDocumentRequestDetailInput,
  FindInternalDocumentVersionInput,
  FindPlatformDocumentVersionInput,
  ListActivityDocumentRequestsInput,
  ListInternalDocumentRequestsInput,
  ListOwnerDocumentRequestsInput,
  ReviewDocumentRequestInput,
  RunCreateWithDuplicateGuardInput,
} from './documents.repository'
import { DuplicateApprovedDocumentError } from './documents.repository'
import { resolveCanonicalType } from './taxonomy/document-taxonomy'

const inactiveEngagementStatuses = [PropertyEngagementStatus.CLOSED, PropertyEngagementStatus.CANCELLED]

async function ensureTenantDocumentStorageCapacity(
  tx: Prisma.TransactionClient,
  tenantId: string,
  requestedBytes: number,
): Promise<void> {
  await lockTenantRow(tx, tenantId)

  const tenant = await tx.tenant.findUnique({
    where: { id: tenantId },
    select: { maxDocumentsStorageMb: true },
  })

  if (!tenant || tenant.maxDocumentsStorageMb === null) {
    return
  }

  const currentStorage = await tx.documentVersion.aggregate({
    where: { document: { documentRequest: { tenantId } } },
    _sum: { sizeBytes: true },
  })
  const currentStorageBytes = currentStorage._sum.sizeBytes ?? 0
  const maxStorageBytes = tenant.maxDocumentsStorageMb * BYTES_PER_MIB

  if (currentStorageBytes + requestedBytes > maxStorageBytes) {
    throw new ConflictException(TENANT_DOCUMENT_STORAGE_LIMIT_EXCEEDED_MESSAGE)
  }
}

async function lockTenantRow(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
  if (typeof tx.$queryRaw !== 'function') {
    return
  }

  await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId} FOR UPDATE`
}

export const documentRequestInclude = {
  document: { include: { currentVersion: true, versions: true } },
  propertyEngagement: { select: { id: true, tenantId: true, propertyAssetId: true } },
} satisfies Prisma.DocumentRequestInclude

const activityDocumentRequestInclude = {
  document: { include: { currentVersion: true } },
  propertyAssetOwner: true,
  propertyEngagement: {
    include: {
      propertyAsset: true,
      agents: {
        include: {
          agentUser: { select: { id: true, email: true, firstName: true } },
        },
        orderBy: { assignedAt: 'asc' },
      },
    },
  },
  requestedByUser: { select: { id: true, email: true, firstName: true } },
} satisfies Prisma.DocumentRequestInclude

const documentVersionDocumentSelect = {
  documentRequestId: true,
  documentRequest: {
    select: {
      id: true,
      tenantId: true,
      requestedByUserId: true,
      title: true,
      propertyEngagementId: true,
      propertyEngagement: { select: { propertyAssetId: true } },
    },
  },
} satisfies Prisma.DocumentSelect

const documentVersionDocumentInclude = {
  document: { select: documentVersionDocumentSelect },
} satisfies Prisma.DocumentVersionInclude

@Injectable()
export class PrismaDocumentsRepository implements DocumentsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findTenantEngagementForDocumentRequest(input: {
    tenantId: string
    propertyEngagementId: string
    propertyAssetOwnerId?: string
    ownerUserId?: string
  }): Promise<{
    id: string
    tenantId: string
    propertyAssetId: string
    propertyAssetOwnerId: string
    ownerUserId: string | null
  } | null> {
    const ownerWhere = this.buildDocumentRequestOwnerWhere(input)

    if (!ownerWhere) {
      return null
    }

    const eligibleOwnerWhere = {
      ...ownerWhere,
      accessStatus: {
        in: [PropertyAssetOwnerAccessStatus.INVITED, PropertyAssetOwnerAccessStatus.ACTIVE],
      },
    } satisfies Prisma.PropertyAssetOwnerWhereInput

    const engagement = await this.prisma.propertyEngagement.findFirst({
      where: {
        id: input.propertyEngagementId,
        tenantId: input.tenantId,
        propertyAsset: {
          owners: {
            some: eligibleOwnerWhere,
          },
        },
      },
      select: {
        id: true,
        tenantId: true,
        propertyAssetId: true,
        propertyAsset: {
          select: {
            owners: {
              where: eligibleOwnerWhere,
              select: { id: true, userId: true },
              take: 1,
            },
          },
        },
      },
    })

    const owner = engagement?.propertyAsset.owners[0]

    if (!engagement || !owner) {
      return null
    }

    return {
      id: engagement.id,
      tenantId: engagement.tenantId,
      propertyAssetId: engagement.propertyAssetId,
      propertyAssetOwnerId: owner.id,
      ownerUserId: owner.userId ?? null,
    }
  }

  createRequest(input: CreateDocumentRequestInput): Promise<DocumentRequestRecord> {
    return this.prisma.documentRequest.create({
      data: {
        tenantId: input.tenantId,
        propertyEngagementId: input.propertyEngagementId,
        propertyAssetOwnerId: input.propertyAssetOwnerId,
        ownerUserId: input.ownerUserId ?? null,
        requestedByUserId: input.requestedByUserId,
        title: input.title,
        description: input.description ?? null,
        status: DocumentRequestStatus.PENDING,
      },
      include: documentRequestInclude,
    })
  }

  async runCreateWithDuplicateGuard(input: RunCreateWithDuplicateGuardInput): Promise<DocumentRequestRecord> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Lock the engagement row to serialize concurrent creates on the same engagement.
      //    Mirrors the lockTenantRow pattern used by ensureTenantDocumentStorageCapacity.
      if (typeof tx.$queryRaw === 'function') {
        await tx.$queryRaw`SELECT id FROM property_engagements WHERE id = ${input.propertyEngagementId} FOR UPDATE`
      }

      // 2. Fetch all APPROVED request titles for this engagement.
      const approvedRequests = await tx.documentRequest.findMany({
        where: {
          propertyEngagementId: input.propertyEngagementId,
          status: DocumentRequestStatus.APPROVED,
        },
        select: { title: true },
      })

      // 3. Resolve each approved title and check for a canonical key collision.
      const hasConflict = approvedRequests.some(
        (r) => resolveCanonicalType(r.title) === input.canonicalKey,
      )

      if (hasConflict) {
        throw new DuplicateApprovedDocumentError()
      }

      // 4. No collision — insert the new request with PENDING status.
      return tx.documentRequest.create({
        data: {
          tenantId: input.tenantId,
          propertyEngagementId: input.propertyEngagementId,
          propertyAssetOwnerId: input.propertyAssetOwnerId,
          ownerUserId: input.ownerUserId ?? null,
          requestedByUserId: input.requestedByUserId,
          title: input.title,
          description: input.description ?? null,
          status: DocumentRequestStatus.PENDING,
        },
        include: documentRequestInclude,
      })
    })
  }

  async listInternalRequests(
    input: ListInternalDocumentRequestsInput,
  ): Promise<{ items: DocumentRequestRecord[]; total: number }> {
    const where = this.buildInternalVisibilityWhere(input)

    const [items, total] = await Promise.all([
      this.prisma.documentRequest.findMany({
        where,
        include: documentRequestInclude,
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.documentRequest.count({ where }),
    ])

    return { items, total }
  }

  async listOwnerRequests(
    input: ListOwnerDocumentRequestsInput,
  ): Promise<{ items: DocumentRequestRecord[]; total: number }> {
    const where = this.buildOwnerRequestWhere(input)

    const [items, total] = await Promise.all([
      this.prisma.documentRequest.findMany({
        where,
        include: documentRequestInclude,
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.documentRequest.count({ where }),
    ])

    return { items, total }
  }

  async listActivityRequests(
    input: ListActivityDocumentRequestsInput,
  ): Promise<{ items: ActivityDocumentRequestRecord[]; total: number }> {
    const where = this.buildActivityRequestWhere(input)

    const [items, total] = await Promise.all([
      this.prisma.documentRequest.findMany({
        where,
        include: activityDocumentRequestInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.documentRequest.count({ where }),
    ])

    return { items, total }
  }

  findInternalRequestDetail(
    input: FindInternalDocumentRequestDetailInput,
  ): Promise<DocumentRequestRecord | null> {
    return this.prisma.documentRequest.findFirst({
      where: this.buildInternalVisibilityWhere(input),
      include: documentRequestInclude,
    })
  }

  findManagerRequestDetail(input: {
    tenantId: string
    requestId: string
  }): Promise<DocumentRequestRecord | null> {
    return this.prisma.documentRequest.findFirst({
      where: { id: input.requestId, tenantId: input.tenantId },
      include: documentRequestInclude,
    })
  }

  findRequesterRequestDetail(input: {
    tenantId: string
    requestId: string
    requestedByUserId: string
  }): Promise<DocumentRequestRecord | null> {
    return this.prisma.documentRequest.findFirst({
      where: {
        id: input.requestId,
        tenantId: input.tenantId,
        requestedByUserId: input.requestedByUserId,
      },
      include: documentRequestInclude,
    })
  }

  createPendingVersion(input: CreatePendingDocumentVersionInput): Promise<DocumentVersionRecord> {
    return this.prisma.$transaction(async (tx) => {
      const documentRequest = await tx.documentRequest.findUnique({
        where: { id: input.documentRequestId },
        select: { tenantId: true },
      })

      if (!documentRequest) {
        throw new NotFoundException('Document request not found')
      }

      await ensureTenantDocumentStorageCapacity(tx, documentRequest.tenantId, input.sizeBytes)

      const document = await tx.document.upsert({
        where: { documentRequestId: input.documentRequestId },
        create: { documentRequestId: input.documentRequestId },
        update: {},
      })

      return tx.documentVersion.create({
        data: {
          documentId: document.id,
          uploadedByUserId: input.uploadedByUserId,
          storageKey: input.storageKey,
          originalFilename: input.originalFilename,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          checksum: input.checksum ?? null,
          status: DocumentVersionStatus.PENDING_UPLOAD,
        },
        include: documentVersionDocumentInclude,
      })
    })
  }

  async markVersionUploaded(input: { versionId: string }): Promise<DocumentVersionRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const version = await tx.documentVersion.update({
        where: { id: input.versionId },
        data: { status: DocumentVersionStatus.UPLOADED },
      })

      const document = await tx.document.update({
        where: { id: version.documentId },
        data: { currentVersionId: version.id },
      })

      await tx.documentRequest.update({
        where: { id: document.documentRequestId },
        data: { status: DocumentRequestStatus.SUBMITTED },
      })

      return tx.documentVersion.findUnique({
        where: { id: version.id },
        include: documentVersionDocumentInclude,
      })
    })
  }

  async reviewRequest(input: ReviewDocumentRequestInput): Promise<DocumentRequestRecord | null> {
    const request = await this.prisma.documentRequest.findFirst({
      where: { id: input.requestId, tenantId: input.tenantId },
      include: { document: { select: { currentVersionId: true } } },
    })

    if (!request) {
      return null
    }

    return this.prisma.$transaction(async (tx) => {
      if (request.document?.currentVersionId) {
        await tx.documentVersion.update({
          where: { id: request.document.currentVersionId },
          data: { status: input.versionStatus },
        })
      }

      return tx.documentRequest.update({
        where: { id: input.requestId },
        data: {
          status: input.status,
          reviewedByUserId: input.reviewedByUserId,
          reviewedAt: new Date(),
          rejectionReason: input.rejectionReason ?? null,
        },
        include: documentRequestInclude,
      })
    })
  }

  findOwnerRequestDetail(input: {
    ownerUserId: string
    requestId: string
  }): Promise<DocumentRequestRecord | null> {
    return this.prisma.documentRequest.findFirst({
      where: {
        id: input.requestId,
        ...this.buildOwnerRequestWhere({ ownerUserId: input.ownerUserId }),
      },
      include: documentRequestInclude,
    })
  }

  findOwnerPendingUploadVersion(input: {
    ownerUserId: string
    versionId: string
  }): Promise<DocumentVersionRecord | null> {
    return this.prisma.documentVersion.findFirst({
      where: {
        id: input.versionId,
        uploadedByUserId: input.ownerUserId,
        status: DocumentVersionStatus.PENDING_UPLOAD,
        document: { documentRequest: this.buildOwnerRequestWhere({ ownerUserId: input.ownerUserId }) },
      },
      include: documentVersionDocumentInclude,
    })
  }

  findOwnerReadableVersion(input: {
    ownerUserId: string
    versionId: string
  }): Promise<DocumentVersionRecord | null> {
    return this.prisma.documentVersion.findFirst({
      where: {
        id: input.versionId,
        status: { in: [DocumentVersionStatus.UPLOADED, DocumentVersionStatus.APPROVED, DocumentVersionStatus.REJECTED] },
        document: { documentRequest: this.buildOwnerRequestWhere({ ownerUserId: input.ownerUserId }) },
      },
    })
  }

  findInternalReadableVersion(input: FindInternalDocumentVersionInput): Promise<DocumentVersionRecord | null> {
    return this.prisma.documentVersion.findFirst({
      where: {
        id: input.versionId,
        status: { in: [DocumentVersionStatus.UPLOADED, DocumentVersionStatus.APPROVED, DocumentVersionStatus.REJECTED] },
        document: { documentRequest: this.buildInternalVersionRequestWhere(input) },
      },
    })
  }

  /**
   * operator-activity-media (Slice 2a, D6): platform-lane variant — strict
   * tenant isolation only, no per-agent viewer scoping (the platform lane has
   * no PropertyAgent concept). Mirrors findInternalReadableVersion's status
   * filter; a wrong-tenant or missing/deleted version both resolve to null so
   * the caller can return a uniform 404 (no cross-tenant existence oracle).
   */
  findPlatformReadableVersion(input: FindPlatformDocumentVersionInput): Promise<DocumentVersionRecord | null> {
    return this.prisma.documentVersion.findFirst({
      where: {
        id: input.versionId,
        status: { in: [DocumentVersionStatus.UPLOADED, DocumentVersionStatus.APPROVED, DocumentVersionStatus.REJECTED] },
        document: { documentRequest: { tenantId: input.tenantId } },
      },
    })
  }

  private buildActivityRequestWhere(input: ListActivityDocumentRequestsInput): Prisma.DocumentRequestWhereInput {
    const createdAt: Prisma.DateTimeFilter = {}

    if (input.from) {
      createdAt.gte = input.from
    }

    if (input.to) {
      // Use `lt` (exclusive end) — paired with parseBusinessDayExclusiveEnd.
      // Do NOT change to `lte`: that would re-introduce the millisecond-boundary
      // edge case that the exclusive-end design intentionally avoids (R2).
      createdAt.lt = input.to
    }

    // Determine base propertyEngagement filter based on visibility/active flags.
    let propertyEngagementBase: Prisma.PropertyEngagementWhereInput | undefined

    if (input.activeEngagementsOnly) {
      propertyEngagementBase = this.buildActiveDocumentEngagementWhere(input)
    } else if (!input.canViewAll) {
      propertyEngagementBase = this.buildAssignedDocumentEngagementWhere(input)
    }

    // When assignedAgentUserId is set, compose an additional independent agents.some clause
    // via Prisma AND so both the viewer-scoping EXISTS and the responsable-scoping EXISTS
    // are emitted as two independent SQL subqueries on PropertyAgent (R-D1).
    let propertyEngagement: Prisma.PropertyEngagementWhereInput | undefined

    if (input.assignedAgentUserId) {
      const assignedClause: Prisma.PropertyEngagementWhereInput = {
        agents: {
          some: {
            tenantId: input.tenantId,
            agentUserId: input.assignedAgentUserId,
          },
        },
      }

      if (propertyEngagementBase) {
        propertyEngagement = {
          ...propertyEngagementBase,
          AND: [
            ...(Array.isArray(propertyEngagementBase.AND)
              ? propertyEngagementBase.AND
              : propertyEngagementBase.AND
                ? [propertyEngagementBase.AND]
                : []),
            assignedClause,
          ],
        }
      } else {
        // canViewAll = true and no activeEngagementsOnly: only apply the assigned-agent filter
        propertyEngagement = assignedClause
      }
    } else {
      propertyEngagement = propertyEngagementBase
    }

    return {
      tenantId: input.tenantId,
      ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
      ...(input.requestedByUserId ? { requestedByUserId: input.requestedByUserId } : {}),
      ...(propertyEngagement ? { propertyEngagement } : {}),
    }
  }

  private buildInternalVisibilityWhere(
    input: ListInternalDocumentRequestsInput | FindInternalDocumentRequestDetailInput,
  ): Prisma.DocumentRequestWhereInput {
    const where: Prisma.DocumentRequestWhereInput = {
      tenantId: input.tenantId,
      ...('requestId' in input ? { id: input.requestId } : {}),
      ...('status' in input && input.status ? { status: input.status } : {}),
      ...('propertyEngagementId' in input && input.propertyEngagementId
        ? { propertyEngagementId: input.propertyEngagementId }
        : {}),
    }

    if (!input.canViewAll) {
      where.propertyEngagement = this.buildAssignedDocumentEngagementWhere(input)
    }

    return where
  }

  private buildInternalVersionRequestWhere(input: FindInternalDocumentVersionInput): Prisma.DocumentRequestWhereInput {
    const where: Prisma.DocumentRequestWhereInput = { tenantId: input.tenantId }

    if (!input.canViewAll) {
      where.propertyEngagement = this.buildAssignedDocumentEngagementWhere(input)
    }

    return where
  }

  private buildAssignedDocumentEngagementWhere(input: {
    tenantId: string
    viewerUserId: string
  }): Prisma.PropertyEngagementWhereInput {
    return {
      tenantId: input.tenantId,
      agents: {
        some: {
          tenantId: input.tenantId,
          agentUserId: input.viewerUserId,
        },
      },
    }
  }

  private buildActiveDocumentEngagementWhere(input: {
    tenantId: string
    viewerUserId: string
    canViewAll: boolean
  }): Prisma.PropertyEngagementWhereInput {
    return {
      tenantId: input.tenantId,
      archivedAt: null,
      status: { notIn: inactiveEngagementStatuses },
      ...(input.canViewAll ? {} : this.buildAssignedDocumentEngagementWhere(input)),
    }
  }

  private buildDocumentRequestOwnerWhere(input: {
    propertyAssetOwnerId?: string
    ownerUserId?: string
  }): Prisma.PropertyAssetOwnerWhereInput | null {
    if (input.propertyAssetOwnerId) {
      return {
        id: input.propertyAssetOwnerId,
        ...(input.ownerUserId ? { userId: input.ownerUserId } : {}),
      }
    }

    if (input.ownerUserId) {
      return { userId: input.ownerUserId }
    }

    return null
  }

  private buildOwnerRequestWhere(input: {
    ownerUserId: string
    status?: DocumentRequestStatus
    propertyEngagementId?: string
  }): Prisma.DocumentRequestWhereInput {
    return {
      ...(input.status ? { status: input.status } : {}),
      ...(input.propertyEngagementId ? { propertyEngagementId: input.propertyEngagementId } : {}),
      OR: [
        {
          propertyAssetOwner: {
            is: {
              userId: input.ownerUserId,
              accessStatus: PropertyAssetOwnerAccessStatus.ACTIVE,
            },
          },
        },
        {
          propertyAssetOwnerId: null,
          ownerUserId: input.ownerUserId,
          propertyEngagement: {
            propertyAsset: {
              owners: {
                some: {
                  userId: input.ownerUserId,
                  accessStatus: PropertyAssetOwnerAccessStatus.ACTIVE,
                },
              },
            },
          },
        },
      ],
    }
  }
}
