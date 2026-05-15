import { Module } from '@nestjs/common'
import { OWNER_PORTAL_REPOSITORY } from './owner-portal.repository'
import { PrismaOwnerPortalRepository } from './prisma-owner-portal.repository'

@Module({
  providers: [{ provide: OWNER_PORTAL_REPOSITORY, useClass: PrismaOwnerPortalRepository }],
  exports: [OWNER_PORTAL_REPOSITORY],
})
export class OwnerPortalModule {}
