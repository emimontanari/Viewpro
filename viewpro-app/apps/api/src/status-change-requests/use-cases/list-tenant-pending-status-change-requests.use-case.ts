import { Inject, Injectable } from '@nestjs/common'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import type { ListStatusChangeRequestsQuery } from '../dto/list-status-change-requests.query'
import {
  STATUS_CHANGE_REQUESTS_REPOSITORY,
  type StatusChangeRequestsRepository,
} from '../status-change-requests.repository'
import { mapStatusChangeRequest, type StatusChangeRequestResponse } from '../responses/status-change-request.response'

@Injectable()
export class ListTenantPendingStatusChangeRequestsUseCase {
  constructor(
    @Inject(STATUS_CHANGE_REQUESTS_REPOSITORY)
    private readonly repo: StatusChangeRequestsRepository,
  ) {}

  async execute(
    tenant: TenantContext,
    query: ListStatusChangeRequestsQuery,
  ): Promise<StatusChangeRequestResponse[]> {
    // R4: hard cap of 200 records, default 200 when omitted.
    const take = query.take ?? 200

    // Sorted createdAt ASC (oldest first) per FR-9.
    const records = await this.repo.listPendingForTenant({
      tenantId: tenant.tenantId,
      take,
    })

    return records.map(mapStatusChangeRequest)
  }
}
