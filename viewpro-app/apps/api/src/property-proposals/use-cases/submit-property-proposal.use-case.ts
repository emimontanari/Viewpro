import {
  ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnprocessableEntityException,
} from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { PROPERTY_PROPOSALS_REPOSITORY, type PropertyProposalsRepository } from '../property-proposals.repository'

const conflict = () => new ConflictException({
  errorCode: 'PROPERTY_PROPOSAL_STATE_CONFLICT', message: 'Property proposal state conflict',
})

@Injectable()
export class SubmitPropertyProposalUseCase {
  constructor(@Inject(PROPERTY_PROPOSALS_REPOSITORY) private readonly propertyProposalsRepository: PropertyProposalsRepository) {}

  async execute(tenant: TenantContext, currentUser: CurrentUser, proposalId: string, input: Record<string, unknown> & { expectedVersion?: unknown }) {
    const expectedVersion = input.expectedVersion
    if (typeof expectedVersion !== 'number' || !Number.isSafeInteger(expectedVersion) || expectedVersion <= 0) throw conflict()

    const result = await this.propertyProposalsRepository.submitForSeller({
      tenantId: tenant.tenantId, proposedByUserId: currentUser.id, proposalId, expectedVersion,
    })
    if (result.kind === 'submitted') return { proposal: result.proposal, round: result.round }
    if (result.kind === 'notFound') {
      throw new NotFoundException({ errorCode: 'PROPERTY_PROPOSAL_NOT_FOUND', message: 'Property proposal not found' })
    }
    if (result.kind === 'ineligible') throw new ForbiddenException('Insufficient permissions')
    if (result.kind === 'incomplete') {
      throw new UnprocessableEntityException({
        errorCode: 'PROPERTY_PROPOSAL_SUBMISSION_INCOMPLETE', message: 'Property proposal submission is incomplete',
      })
    }
    throw conflict()
  }
}
