import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { assertDraftTitle, normalizeStagedScalars, type StagedPropertyScalarsInput } from '../domain/normalization'
import {
  PROPERTY_PROPOSALS_REPOSITORY,
  type PropertyProposalsRepository,
} from '../property-proposals.repository'

export type CreatePropertyProposalInput = Partial<StagedPropertyScalarsInput> & Record<string, unknown>

@Injectable()
export class CreatePropertyProposalUseCase {
  constructor(
    @Inject(PROPERTY_PROPOSALS_REPOSITORY)
    private readonly propertyProposalsRepository: PropertyProposalsRepository,
  ) {}

  async execute(tenant: TenantContext, currentUser: CurrentUser, input: CreatePropertyProposalInput) {
    const staged = normalizeStagedScalars(input)
    assertDraftTitle(staged)
    const result = await this.propertyProposalsRepository.createDraft({
      ...staged,
      title: staged.title!,
      tenantId: tenant.tenantId,
      proposedByUserId: currentUser.id,
    })
    if (result.kind === 'ineligible') throw new ForbiddenException('Insufficient permissions')
    return result.proposal
  }
}
