import { Inject, Injectable } from '@nestjs/common'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import {
  PROPERTY_ENGAGEMENTS_REPOSITORY,
  type PropertyEngagementsRepository,
} from '../property-engagements.repository'
import { type PropertyEngagementResponse } from '../responses/property-engagement.response'
import { mapPrimaryPropertyAgentResult } from './set-primary-property-agent.use-case'

export type ClearPrimaryPropertyAgentInput = {
  expectedPrimaryAgentId: string | null
}

@Injectable()
export class ClearPrimaryPropertyAgentUseCase {
  constructor(
    @Inject(PROPERTY_ENGAGEMENTS_REPOSITORY)
    private readonly propertyEngagementsRepository: PropertyEngagementsRepository,
  ) {}

  async execute(
    tenant: TenantContext,
    engagementId: string,
    input: ClearPrimaryPropertyAgentInput,
  ): Promise<PropertyEngagementResponse> {
    const result = await this.propertyEngagementsRepository.clearPrimaryAgent({
      tenantId: tenant.tenantId,
      engagementId,
      expectedPrimaryAgentId: input.expectedPrimaryAgentId,
    })

    return mapPrimaryPropertyAgentResult(result)
  }
}
