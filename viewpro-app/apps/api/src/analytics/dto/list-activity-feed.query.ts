import { Transform } from "class-transformer";
import {
	IsEnum,
	IsISO8601,
	IsInt,
	IsOptional,
	IsUUID,
	Max,
	Min,
} from "class-validator";
import { MovementType } from "@prisma/client";

export class ListActivityFeedQuery {
	@IsOptional()
	@Transform(({ value }) => Number(value))
	@IsInt()
	@Min(1)
	page = 1;

	@IsOptional()
	@Transform(({ value }) => Number(value))
	@IsInt()
	@Min(1)
	@Max(50)
	pageSize = 20;

	@IsOptional()
	@IsEnum(MovementType)
	type?: MovementType;

	@IsOptional()
	@IsUUID()
	sellerId?: string;

	@IsOptional()
	@IsISO8601()
	dateFrom?: string;

	@IsOptional()
	@IsISO8601()
	dateTo?: string;
}
