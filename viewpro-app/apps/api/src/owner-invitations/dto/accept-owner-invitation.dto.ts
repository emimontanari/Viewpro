import {
	IsIn,
	IsOptional,
	IsString,
	MinLength,
	ValidateIf,
} from "class-validator";

export type OwnerInvitationAcceptMode =
	| "register"
	| "login"
	| "current-session";

export class AcceptOwnerInvitationDto {
	@IsOptional()
	@IsIn(["register", "login", "current-session"])
	mode?: OwnerInvitationAcceptMode;

	@ValidateIf(
		(dto: AcceptOwnerInvitationDto) => !dto.mode || dto.mode === "register",
	)
	@IsString()
	@MinLength(1)
	firstName?: string;

	@IsOptional()
	@IsString()
	lastName?: string;

	@ValidateIf((dto: AcceptOwnerInvitationDto) => dto.mode !== "current-session")
	@IsString()
	@MinLength(8)
	password?: string;
}
