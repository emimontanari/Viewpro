import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { OWNER_ACCESS_REPOSITORY } from './owner-access.repository'
import { PrismaOwnerAccessRepository } from './prisma-owner-access.repository'

/**
 * Deliberately tiny, and deliberately not part of OwnerPortalModule.
 *
 * Auth needs this question answered to build a session, and OwnerPortalModule
 * imports AuthModule — putting it there would make the two modules import each
 * other. This depends on the database and nothing else.
 */
@Module({
  imports: [DatabaseModule],
  providers: [{ provide: OWNER_ACCESS_REPOSITORY, useClass: PrismaOwnerAccessRepository }],
  exports: [OWNER_ACCESS_REPOSITORY],
})
export class OwnerAccessModule {}
