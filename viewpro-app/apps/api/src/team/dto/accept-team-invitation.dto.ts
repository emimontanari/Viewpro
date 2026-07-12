import {
	IsIn,
	IsOptional,
	IsString,
	MinLength,
	ValidateIf,
} from "class-validator";

export const ACCEPT_TEAM_INVITATION_MODES = [
	"register",
	"login",
	"current-session",
] as const;

export type AcceptTeamInvitationMode =
	(typeof ACCEPT_TEAM_INVITATION_MODES)[number];

export class AcceptTeamInvitationDto {
	@IsIn(ACCEPT_TEAM_INVITATION_MODES)
	mode!: AcceptTeamInvitationMode;

	@ValidateIf((dto: AcceptTeamInvitationDto) => dto.mode === "register")
	@IsString()
	@MinLength(1)
	firstName?: string;

	@ValidateIf((dto: AcceptTeamInvitationDto) => dto.mode === "register")
	@IsOptional()
	@IsString()
	lastName?: string;

	@ValidateIf(
		(dto: AcceptTeamInvitationDto) =>
			dto.mode === "register" || dto.mode === "login",
	)
	@IsString()
	@MinLength(8)
	password?: string;
}
