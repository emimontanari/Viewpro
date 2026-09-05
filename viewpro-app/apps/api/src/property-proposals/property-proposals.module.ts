import { Module } from '@nestjs/common'
import { PrismaPropertyProposalsRepository } from './prisma-property-proposals.repository'
import { PROPERTY_PROPOSALS_REPOSITORY } from './property-proposals.repository'
import { CreatePropertyProposalUseCase } from './use-cases/create-property-proposal.use-case'
import { GetPropertyProposalUseCase } from './use-cases/get-property-proposal.use-case'
import { ListPropertyProposalsUseCase } from './use-cases/list-property-proposals.use-case'

const propertyProposalUseCases = [
  CreatePropertyProposalUseCase,
  GetPropertyProposalUseCase,
  ListPropertyProposalsUseCase,
]

@Module({
  providers: [
    { provide: PROPERTY_PROPOSALS_REPOSITORY, useClass: PrismaPropertyProposalsRepository },
    ...propertyProposalUseCases,
  ],
  exports: [PROPERTY_PROPOSALS_REPOSITORY, ...propertyProposalUseCases],
})
export class PropertyProposalsModule {}
