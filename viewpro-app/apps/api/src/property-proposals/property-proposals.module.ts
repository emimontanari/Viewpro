import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { MembershipsModule } from '../memberships/memberships.module'
import { PermissionsModule } from '../permissions/permissions.module'
import { TenantContextModule } from '../tenant-context/tenant-context.module'
import { PropertyProposalsController } from './property-proposals.controller'
import { PrismaPropertyProposalsRepository } from './prisma-property-proposals.repository'
import { PROPERTY_PROPOSALS_REPOSITORY } from './property-proposals.repository'
import { CreatePropertyProposalUseCase } from './use-cases/create-property-proposal.use-case'
import { GetPropertyProposalUseCase } from './use-cases/get-property-proposal.use-case'
import { ListPropertyProposalsUseCase } from './use-cases/list-property-proposals.use-case'
import { SubmitPropertyProposalUseCase } from './use-cases/submit-property-proposal.use-case'
import { UpdatePropertyProposalUseCase } from './use-cases/update-property-proposal.use-case'

const propertyProposalUseCases = [
  CreatePropertyProposalUseCase,
  GetPropertyProposalUseCase,
  ListPropertyProposalsUseCase,
  SubmitPropertyProposalUseCase,
  UpdatePropertyProposalUseCase,
]

@Module({
  imports: [AuthModule, MembershipsModule, PermissionsModule, TenantContextModule],
  controllers: [PropertyProposalsController],
  providers: [
    { provide: PROPERTY_PROPOSALS_REPOSITORY, useClass: PrismaPropertyProposalsRepository },
    ...propertyProposalUseCases,
  ],
  exports: [PROPERTY_PROPOSALS_REPOSITORY, ...propertyProposalUseCases],
})
export class PropertyProposalsModule {}
