import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { mapDocumentRequestResponse, type DocumentRequestResponse } from '../document-response.mapper'
import type { ListDocumentRequestsQuery } from '../dto/list-document-requests.query'
import { DOCUMENTS_REPOSITORY, type DocumentsRepository } from '../documents.repository'
import { canViewAllDocumentRequests } from './document-permissions'

export type ListDocumentRequestsResponse = {
  items: DocumentRequestResponse[]
  total: number
  page: number
  pageSize: number
}

@Injectable()
export class ListDocumentRequestsUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
  ) {}

  async execute(
    tenant: TenantContext,
    currentUser: CurrentUser,
    query: ListDocumentRequestsQuery,
  ): Promise<ListDocumentRequestsResponse> {
    const canViewAll = canViewAllDocumentRequests(tenant)

    if (!canViewAll && !tenant.permissions.includes(PERMISSIONS.DOCUMENTS_REVIEW_OWN)) {
      throw new ForbiddenException('Insufficient permissions')
    }

    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const result = await this.documentsRepository.listInternalRequests({
      tenantId: tenant.tenantId,
      viewerUserId: currentUser.id,
      canViewAll,
      page,
      pageSize,
      status: query.status,
      propertyEngagementId: query.propertyEngagementId,
    })

    return { items: result.items.map(mapDocumentRequestResponse), total: result.total, page, pageSize }
  }
}
