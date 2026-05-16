import { Injectable } from '@nestjs/common'
import { DocumentRequestStatus, DocumentVersionStatus, Prisma } from '@prisma/client'
import { PrismaService } from '../database/prisma.service'
import type {
  CreateDocumentRequestInput,
  CreatePendingDocumentVersionInput,
  DocumentRequestRecord,
  DocumentsRepository,
  DocumentVersionRecord,
  FindInternalDocumentRequestDetailInput,
  FindInternalDocumentVersionInput,
  ListInternalDocumentRequestsInput,
  ListOwnerDocumentRequestsInput,
  ReviewDocumentRequestInput,
} from './documents.repository'

export const documentRequestInclude = {
  document: { include: { currentVersion: true, versions: true } },
  propertyEngagement: { select: { id: true, tenantId: true, propertyAssetId: true } },
} satisfies Prisma.DocumentRequestInclude

@Injectable()
export class PrismaDocumentsRepository implements DocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findTenantEngagementForDocumentRequest(input: {
    tenantId: string
    propertyEngagementId: string
    ownerUserId: string
  }): Promise<{ id: string; tenantId: string; propertyAssetId: string } | null> {
    return this.prisma.propertyEngagement.findFirst({
      where: {
        id: input.propertyEngagementId,
        tenantId: input.tenantId,
        propertyAsset: { owners: { some: { userId: input.ownerUserId, accessStatus: 'ACTIVE' } } },
      },
      select: { id: true, tenantId: true, propertyAssetId: true },
    })
  }

  createRequest(input: CreateDocumentRequestInput): Promise<DocumentRequestRecord> {
    return this.prisma.documentRequest.create({
      data: {
        tenantId: input.tenantId,
        propertyEngagementId: input.propertyEngagementId,
        ownerUserId: input.ownerUserId,
        requestedByUserId: input.requestedByUserId,
        title: input.title,
        description: input.description ?? null,
        status: DocumentRequestStatus.PENDING,
      },
      include: documentRequestInclude,
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
        include: { document: { select: { documentRequestId: true } } },
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
        include: { document: { select: { documentRequestId: true } } },
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
        ownerUserId: input.ownerUserId,
        propertyEngagement: {
          propertyAsset: { owners: { some: { userId: input.ownerUserId, accessStatus: 'ACTIVE' } } },
        },
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
      include: { document: { select: { documentRequestId: true } } },
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

  private buildInternalVisibilityWhere(
    input: ListInternalDocumentRequestsInput | FindInternalDocumentRequestDetailInput,
  ): Prisma.DocumentRequestWhereInput {
    const where: Prisma.DocumentRequestWhereInput = {
      tenantId: input.tenantId,
      ...('requestId' in input ? { id: input.requestId } : {}),
      ...('status' in input && input.status ? { status: input.status } : {}),
    }

    if (!input.canViewAll) {
      where.requestedByUserId = input.viewerUserId
    }

    return where
  }

  private buildInternalVersionRequestWhere(input: FindInternalDocumentVersionInput): Prisma.DocumentRequestWhereInput {
    const where: Prisma.DocumentRequestWhereInput = { tenantId: input.tenantId }

    if (!input.canViewAll) {
      where.requestedByUserId = input.viewerUserId
    }

    return where
  }

  private buildOwnerRequestWhere(input: {
    ownerUserId: string
    status?: DocumentRequestStatus
  }): Prisma.DocumentRequestWhereInput {
    return {
      ownerUserId: input.ownerUserId,
      ...(input.status ? { status: input.status } : {}),
      propertyEngagement: {
        propertyAsset: { owners: { some: { userId: input.ownerUserId, accessStatus: 'ACTIVE' } } },
      },
    }
  }
}
