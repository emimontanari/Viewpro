import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MembershipsModule } from "../memberships/memberships.module";
import { PermissionsModule } from "../permissions/permissions.module";
import { TenantContextModule } from "../tenant-context/tenant-context.module";
import { UsersModule } from "../users/users.module";
import { PrismaTeamInvitationsRepository } from "./prisma-team-invitations.repository";
import { TeamController } from "./team.controller";
import { TeamInvitationsPublicController } from "./team-invitations-public.controller";
import { TEAM_INVITATIONS_REPOSITORY } from "./team-invitations.repository";
import { AcceptTeamInvitationUseCase } from "./use-cases/accept-team-invitation.use-case";
import { CreateTeamInvitationUseCase } from "./use-cases/create-team-invitation.use-case";
import { ListTeamInvitationsUseCase } from "./use-cases/list-team-invitations.use-case";
import { ListTeamMembersUseCase } from "./use-cases/list-team-members.use-case";
import { ResendTeamInvitationUseCase } from "./use-cases/resend-team-invitation.use-case";
import { RevokeTeamInvitationUseCase } from "./use-cases/revoke-team-invitation.use-case";
import { ValidateTeamInvitationUseCase } from "./use-cases/validate-team-invitation.use-case";

@Module({
	imports: [
		AuthModule,
		MembershipsModule,
		PermissionsModule,
		TenantContextModule,
		UsersModule,
	],
	controllers: [TeamController, TeamInvitationsPublicController],
	providers: [
		ListTeamMembersUseCase,
		ListTeamInvitationsUseCase,
		CreateTeamInvitationUseCase,
		ResendTeamInvitationUseCase,
		RevokeTeamInvitationUseCase,
		ValidateTeamInvitationUseCase,
		AcceptTeamInvitationUseCase,
		{
			provide: TEAM_INVITATIONS_REPOSITORY,
			useClass: PrismaTeamInvitationsRepository,
		},
	],
})
export class TeamModule {}
