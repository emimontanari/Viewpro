import { IsOptional, IsString, MaxLength } from "class-validator";

export class ArchivePropertyEngagementDto {
	@IsOptional()
	@IsString()
	@MaxLength(240)
	reason?: string;
}
