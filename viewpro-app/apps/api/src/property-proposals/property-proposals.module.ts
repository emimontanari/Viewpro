import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { MembershipsModule } from '../memberships/memberships.module'
import { PermissionsModule } from '../permissions/permissions.module'
import { PropertyEngagementsModule } from '../property-engagements/property-engagements.module'
import { TenantContextModule } from '../tenant-context/tenant-context.module'
import { PropertyProposalsController } from './property-proposals.controller'
import { PrismaPropertyProposalsRepository } from './prisma-property-proposals.repository'
import { PROPERTY_PROPOSALS_REPOSITORY } from './property-proposals.repository'
import { ApprovePropertyProposalUseCase } from './use-cases/approve-property-proposal.use-case'
import { CreatePropertyProposalUseCase } from './use-cases/create-property-proposal.use-case'
import { GetPropertyProposalReviewUseCase } from './use-cases/get-property-proposal-review.use-case'
import { GetPropertyProposalUseCase } from './use-cases/get-property-proposal.use-case'
import { ListPropertyProposalReviewUseCase } from './use-cases/list-property-proposal-review.use-case'
import { ListPropertyProposalsUseCase } from './use-cases/list-property-proposals.use-case'
import { RejectPropertyProposalUseCase } from './use-cases/reject-property-proposal.use-case'
import { SubmitPropertyProposalUseCase } from './use-cases/submit-property-proposal.use-case'
import { UpdatePropertyProposalUseCase } from './use-cases/update-property-proposal.use-case'

const propertyProposalUseCases = [
  CreatePropertyProposalUseCase,
  GetPropertyProposalUseCase,
  ListPropertyProposalsUseCase,
  SubmitPropertyProposalUseCase,
  UpdatePropertyProposalUseCase,
  ListPropertyProposalReviewUseCase,
  GetPropertyProposalReviewUseCase,
  RejectPropertyProposalUseCase,
  ApprovePropertyProposalUseCase,
]

@Module({
  imports: [AuthModule, MembershipsModule, PermissionsModule, TenantContextModule, PropertyEngagementsModule],
  controllers: [PropertyProposalsController],
  providers: [
    { provide: PROPERTY_PROPOSALS_REPOSITORY, useClass: PrismaPropertyProposalsRepository },
    ...propertyProposalUseCases,
  ],
  exports: [PROPERTY_PROPOSALS_REPOSITORY, ...propertyProposalUseCases],
})
export class PropertyProposalsModule {}
