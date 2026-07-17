import { Module } from '@nestjs/common'
import { MEMBERSHIP_ACTIVITY_REPOSITORY } from './membership-activity.repository'
import { MEMBERSHIPS_REPOSITORY } from './memberships.repository'
import { PrismaMembershipActivityRepository } from './prisma-membership-activity.repository'
import { PrismaMembershipsRepository } from './prisma-memberships.repository'

@Module({
  providers: [
    { provide: MEMBERSHIPS_REPOSITORY, useClass: PrismaMembershipsRepository },
    { provide: MEMBERSHIP_ACTIVITY_REPOSITORY, useClass: PrismaMembershipActivityRepository },
  ],
  exports: [MEMBERSHIPS_REPOSITORY, MEMBERSHIP_ACTIVITY_REPOSITORY],
})
export class MembershipsModule {}
