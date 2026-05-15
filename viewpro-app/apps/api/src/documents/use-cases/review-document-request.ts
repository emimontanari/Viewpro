import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { DocumentRequestStatus } from '@prisma/client'
import type { CurrentUser } from '../../auth/types/current-user'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import type { DocumentRequestRecord, DocumentsRepository } from '../documents.repository'
import { canViewAllDocumentRequests } from './document-permissions'

export async function findReviewableDocumentRequest(
  documentsRepository: DocumentsRepository,
  tenant: TenantContext,
  currentUser: CurrentUser,
  requestId: string,
): Promise<DocumentRequestRecord> {
  const canViewAll = canViewAllDocumentRequests(tenant)

  if (!canViewAll && !tenant.permissions.includes(PERMISSIONS.DOCUMENTS_REVIEW_OWN)) {
    throw new ForbiddenException('Insufficient permissions')
  }

  const request = await documentsRepository.findInternalRequestDetail({
    tenantId: tenant.tenantId,
    requestId,
    viewerUserId: currentUser.id,
    canViewAll,
  })

  if (!request) {
    throw new NotFoundException('Document request not found')
  }

  if (request.status !== DocumentRequestStatus.SUBMITTED) {
    throw new BadRequestException('Document request is not submitted')
  }

  return request
}
