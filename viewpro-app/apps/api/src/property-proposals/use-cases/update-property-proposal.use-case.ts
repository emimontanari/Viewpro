import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { buildUpdateReplayIdentity } from '../domain/replay-identity'
import type { StagedPropertyScalarsInput } from '../domain/normalization'
import { PROPERTY_PROPOSALS_REPOSITORY, type PropertyProposalsRepository } from '../property-proposals.repository'

export type UpdatePropertyProposalInput = Partial<StagedPropertyScalarsInput> & Record<string, unknown> & {
  expectedVersion: unknown
}

const conflict = () => new ConflictException({
  errorCode: 'PROPERTY_PROPOSAL_STATE_CONFLICT', message: 'Property proposal state conflict',
})

@Injectable()
export class UpdatePropertyProposalUseCase {
  constructor(@Inject(PROPERTY_PROPOSALS_REPOSITORY) private readonly propertyProposalsRepository: PropertyProposalsRepository) {}

  async execute(tenant: TenantContext, currentUser: CurrentUser, proposalId: string, input: UpdatePropertyProposalInput) {
    const expectedVersion = input.expectedVersion
    if (typeof expectedVersion !== 'number' || !Number.isSafeInteger(expectedVersion) || expectedVersion <= 0) throw conflict()
    const result = await this.propertyProposalsRepository.updateForSeller({
      tenantId: tenant.tenantId,
      proposedByUserId: currentUser.id,
      proposalId,
      expectedVersion,
      patch: buildUpdateReplayIdentity(expectedVersion, input).patch,
    })
    if ('proposal' in result) return result.proposal
    if (result.kind === 'notFound') {
      throw new NotFoundException({ errorCode: 'PROPERTY_PROPOSAL_NOT_FOUND', message: 'Property proposal not found' })
    }
    if (result.kind === 'ineligible') throw new ForbiddenException('Insufficient permissions')
    throw conflict()
  }
}
