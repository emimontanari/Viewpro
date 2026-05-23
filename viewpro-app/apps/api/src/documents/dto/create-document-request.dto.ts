import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateDocumentRequestDto {
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	propertyAssetOwnerId?: string;

	@IsOptional()
	@IsString()
	@IsNotEmpty()
	ownerUserId?: string;

	@IsString()
	@IsNotEmpty()
	@MaxLength(200)
	title!: string;

	@IsOptional()
	@IsString()
	@MaxLength(2000)
	description?: string;
}
