import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OwnerInvitationsController } from "./owner-invitations.controller";
import { OWNER_INVITATIONS_REPOSITORY } from "./owner-invitations.repository";
import { PrismaOwnerInvitationsRepository } from "./prisma-owner-invitations.repository";
import { AcceptOwnerInvitationUseCase } from "./use-cases/accept-owner-invitation.use-case";
import { ValidateOwnerInvitationUseCase } from "./use-cases/validate-owner-invitation.use-case";
import { MembershipsModule } from "../memberships/memberships.module";

@Module({
	imports: [AuthModule, MembershipsModule],
	controllers: [OwnerInvitationsController],
	providers: [
		ValidateOwnerInvitationUseCase,
		AcceptOwnerInvitationUseCase,
		{
			provide: OWNER_INVITATIONS_REPOSITORY,
			useClass: PrismaOwnerInvitationsRepository,
		},
	],
})
export class OwnerInvitationsModule {}
