import { Module } from '@nestjs/common'
import { MembershipsModule } from '../memberships/memberships.module'
import { PrismaPropertyEngagementsRepository } from './prisma-property-engagements.repository'
import { PROPERTY_ENGAGEMENTS_REPOSITORY } from './property-engagements.repository'
import { AssignPropertyAgentUseCase } from './use-cases/assign-property-agent.use-case'
import { CreatePropertyEngagementUseCase } from './use-cases/create-property-engagement.use-case'
import { GetPropertyEngagementUseCase } from './use-cases/get-property-engagement.use-case'
import { ListPropertyEngagementsUseCase } from './use-cases/list-property-engagements.use-case'

const propertyEngagementUseCases = [
  CreatePropertyEngagementUseCase,
  ListPropertyEngagementsUseCase,
  GetPropertyEngagementUseCase,
  AssignPropertyAgentUseCase,
]

@Module({
  imports: [MembershipsModule],
  providers: [
    { provide: PROPERTY_ENGAGEMENTS_REPOSITORY, useClass: PrismaPropertyEngagementsRepository },
    ...propertyEngagementUseCases,
  ],
  exports: [PROPERTY_ENGAGEMENTS_REPOSITORY, ...propertyEngagementUseCases],
})
export class PropertyEngagementsModule {}
