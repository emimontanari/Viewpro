import { IsEmail } from "class-validator";

export class LinkPropertyOwnerDto {
	@IsEmail()
	email!: string;
}
