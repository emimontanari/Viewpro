import { Controller, Get, Inject, Param } from "@nestjs/common";
import { ValidateOwnerInvitationUseCase } from "./use-cases/validate-owner-invitation.use-case";

@Controller("owner-invitations")
export class OwnerInvitationsController {
	constructor(
		@Inject(ValidateOwnerInvitationUseCase)
		private readonly validateOwnerInvitationUseCase: ValidateOwnerInvitationUseCase,
	) {}

	@Get(":token")
	validate(@Param("token") token: string) {
		return this.validateOwnerInvitationUseCase.execute(token);
	}
}
