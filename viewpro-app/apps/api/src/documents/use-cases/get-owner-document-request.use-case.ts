import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import { mapDocumentRequestResponse, type DocumentRequestResponse } from '../document-response.mapper'
import { DOCUMENTS_REPOSITORY, type DocumentsRepository } from '../documents.repository'

@Injectable()
export class GetOwnerDocumentRequestUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
  ) {}

  async execute(currentUser: CurrentUser, requestId: string): Promise<DocumentRequestResponse> {
    const request = await this.documentsRepository.findOwnerRequestDetail({ ownerUserId: currentUser.id, requestId })

    if (!request) {
      throw new NotFoundException('Document request not found')
    }

    return mapDocumentRequestResponse(request)
  }
}
