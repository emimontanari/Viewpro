import { Module } from '@nestjs/common'
import { MEMBERSHIPS_REPOSITORY } from './memberships.repository'
import { PrismaMembershipsRepository } from './prisma-memberships.repository'

@Module({
  providers: [{ provide: MEMBERSHIPS_REPOSITORY, useClass: PrismaMembershipsRepository }],
  exports: [MEMBERSHIPS_REPOSITORY],
})
export class MembershipsModule {}
