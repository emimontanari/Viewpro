import {
	PropertyEngagementStatus,
	PropertyOperationType,
} from "@prisma/client";
import { Transform } from "class-transformer";
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export const propertyArchiveFilters = ["active", "archived", "all"] as const;
export type PropertyArchiveFilter = (typeof propertyArchiveFilters)[number];

export class ListPropertyEngagementsQuery {
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
	@IsEnum(PropertyEngagementStatus)
	status?: PropertyEngagementStatus;

	@IsOptional()
	@IsEnum(PropertyOperationType)
	operationType?: PropertyOperationType;

	@IsOptional()
	@IsIn(propertyArchiveFilters)
	archived: PropertyArchiveFilter = "active";
}
