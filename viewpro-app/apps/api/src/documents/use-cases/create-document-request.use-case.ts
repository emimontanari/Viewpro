import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { mapDocumentRequestResponse, type DocumentRequestResponse } from '../document-response.mapper'
import type { CreateDocumentRequestDto } from '../dto/create-document-request.dto'
import { DOCUMENTS_REPOSITORY, type DocumentsRepository } from '../documents.repository'

@Injectable()
export class CreateDocumentRequestUseCase {
  constructor(
    @Inject(DOCUMENTS_REPOSITORY)
    private readonly documentsRepository: DocumentsRepository,
  ) {}

  async execute(
    tenant: TenantContext,
    currentUser: CurrentUser,
    propertyEngagementId: string,
    input: CreateDocumentRequestDto,
  ): Promise<DocumentRequestResponse> {
    if (!tenant.permissions.includes(PERMISSIONS.DOCUMENTS_REQUEST)) {
      throw new ForbiddenException('Insufficient permissions')
    }

    const engagement = await this.documentsRepository.findTenantEngagementForDocumentRequest({
      tenantId: tenant.tenantId,
      propertyEngagementId,
      ownerUserId: input.ownerUserId,
    })

    if (!engagement) {
      throw new NotFoundException('Property engagement not found')
    }

    const request = await this.documentsRepository.createRequest({
      tenantId: tenant.tenantId,
      propertyEngagementId,
      ownerUserId: input.ownerUserId,
      requestedByUserId: currentUser.id,
      title: input.title,
      description: input.description,
    })

    return mapDocumentRequestResponse(request)
  }
}
