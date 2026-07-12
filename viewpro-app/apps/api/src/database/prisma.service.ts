import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { assertSafeTestDatabaseUrl } from "./test-database-url.guard";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
	constructor() {
		assertSafeTestDatabaseUrl();
		super();
	}

	async onModuleDestroy() {
		await this.$disconnect();
	}
}
