import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { MembershipsModule } from '../memberships/memberships.module'
import { PermissionsModule } from '../permissions/permissions.module'
import { TenantContextModule } from '../tenant-context/tenant-context.module'
import { TeamController } from './team.controller'
import { ListTeamMembersUseCase } from './use-cases/list-team-members.use-case'

@Module({
  imports: [AuthModule, MembershipsModule, PermissionsModule, TenantContextModule],
  controllers: [TeamController],
  providers: [ListTeamMembersUseCase],
})
export class TeamModule {}
