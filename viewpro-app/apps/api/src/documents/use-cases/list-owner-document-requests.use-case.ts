import { Inject, Injectable } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import { mapDocumentRequestResponse, type DocumentRequestResponse } from '../document-response.mapper'
import type { ListDocumentRequestsQuery } from '../dto/list-document-requests.query'
import { DOCUMENTS_REPOSITORY, type DocumentsRepository } from '../documents.repository'

export type ListOwnerDocumentRequestsResponse = {
  items: DocumentRequestResponse[]
  total: number
  page: number
  pageSize: number
}

@Injectable()
export class ListOwnerDocumentRequestsUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
  ) {}

  async execute(currentUser: CurrentUser, query: ListDocumentRequestsQuery): Promise<ListOwnerDocumentRequestsResponse> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const result = await this.documentsRepository.listOwnerRequests({
      ownerUserId: currentUser.id,
      page,
      pageSize,
      status: query.status,
      propertyEngagementId: query.propertyEngagementId,
    })

    return { items: result.items.map(mapDocumentRequestResponse), total: result.total, page, pageSize }
  }
}
