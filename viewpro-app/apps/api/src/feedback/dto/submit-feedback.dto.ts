import { FeedbackType } from "@prisma/client";
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

const PATHNAME = /^\/[^?#]*$/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class SubmitFeedbackDto {
	@IsEnum(FeedbackType)
	type!: FeedbackType;

	@IsString()
	@MinLength(10)
	@MaxLength(2000)
	description!: string;

	@IsOptional()
	@IsString()
	@MaxLength(512)
	@Matches(PATHNAME)
	pathname?: string;

	@IsOptional()
	@IsString()
	@Matches(UUID_V4)
	requestId?: string;
}
