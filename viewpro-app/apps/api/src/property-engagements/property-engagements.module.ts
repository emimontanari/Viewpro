import { Module } from '@nestjs/common'
import { PrismaPropertyEngagementsRepository } from './prisma-property-engagements.repository'
import { PROPERTY_ENGAGEMENTS_REPOSITORY } from './property-engagements.repository'

@Module({
  providers: [{ provide: PROPERTY_ENGAGEMENTS_REPOSITORY, useClass: PrismaPropertyEngagementsRepository }],
  exports: [PROPERTY_ENGAGEMENTS_REPOSITORY],
})
export class PropertyEngagementsModule {}
