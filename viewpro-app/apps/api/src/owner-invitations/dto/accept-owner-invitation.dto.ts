import { IsOptional, IsString, MinLength } from "class-validator";

export class AcceptOwnerInvitationDto {
	@IsString()
	@MinLength(1)
	firstName!: string;

	@IsOptional()
	@IsString()
	lastName?: string;

	@IsString()
	@MinLength(8)
	password!: string;
}
