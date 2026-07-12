import { Transform } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, Max, Min } from "class-validator";

export class ListNotificationsQuery {
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
	@Transform(({ value }) => {
		if (value === true || value === "true") {
			return true;
		}
		if (value === false || value === "false") {
			return false;
		}
		return value;
	})
	@IsBoolean()
	unreadOnly = false;
}
