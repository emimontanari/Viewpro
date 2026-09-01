import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import {
  PROPERTY_ENGAGEMENTS_REPOSITORY,
  type PrimaryPropertyAgentResult,
  type PropertyEngagementsRepository,
} from '../property-engagements.repository'
import { mapPropertyEngagement, type PropertyEngagementResponse } from '../responses/property-engagement.response'

export type SetPrimaryPropertyAgentInput = {
  agentId: string
  expectedPrimaryAgentId: string | null
}

@Injectable()
export class SetPrimaryPropertyAgentUseCase {
  constructor(
    @Inject(PROPERTY_ENGAGEMENTS_REPOSITORY)
    private readonly propertyEngagementsRepository: PropertyEngagementsRepository,
  ) {}

  async execute(
    tenant: TenantContext,
    engagementId: string,
    input: SetPrimaryPropertyAgentInput,
  ): Promise<PropertyEngagementResponse> {
    const result = await this.propertyEngagementsRepository.setPrimaryAgent({
      tenantId: tenant.tenantId,
      engagementId,
      agentId: input.agentId,
      expectedPrimaryAgentId: input.expectedPrimaryAgentId,
    })

    return mapPrimaryPropertyAgentResult(result)
  }
}

export function mapPrimaryPropertyAgentResult(
  result: PrimaryPropertyAgentResult,
): PropertyEngagementResponse {
  switch (result.status) {
    case 'updated':
      return mapPropertyEngagement(result.engagement)
    case 'engagementNotFound':
      throw new NotFoundException('Property engagement not found')
    case 'candidateInvalid':
      throw new BadRequestException({
        errorCode: 'PRIMARY_AGENT_CANDIDATE_INVALID',
        message: 'Primary agent candidate is invalid',
      })
    case 'stateConflict':
      throw new ConflictException({
        errorCode: 'PRIMARY_AGENT_STATE_CONFLICT',
        message: 'Primary agent state has changed',
      })
  }
}
