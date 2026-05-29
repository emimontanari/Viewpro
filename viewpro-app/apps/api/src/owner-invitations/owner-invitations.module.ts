import { Module } from "@nestjs/common";
import { OwnerInvitationsController } from "./owner-invitations.controller";
import { OWNER_INVITATIONS_REPOSITORY } from "./owner-invitations.repository";
import { PrismaOwnerInvitationsRepository } from "./prisma-owner-invitations.repository";
import { ValidateOwnerInvitationUseCase } from "./use-cases/validate-owner-invitation.use-case";

@Module({
	controllers: [OwnerInvitationsController],
	providers: [
		ValidateOwnerInvitationUseCase,
		{
			provide: OWNER_INVITATIONS_REPOSITORY,
			useClass: PrismaOwnerInvitationsRepository,
		},
	],
})
export class OwnerInvitationsModule {}
