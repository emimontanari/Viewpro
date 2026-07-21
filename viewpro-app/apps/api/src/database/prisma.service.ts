import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { ClsService } from "nestjs-cls";
import { assertSafeTestDatabaseUrl } from "./test-database-url.guard";
import { createTenantIsolationExtension } from "./tenant-isolation.extension";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
	constructor(private readonly cls: ClsService) {
		assertSafeTestDatabaseUrl();
		super();

		// Isolation backstop (Phase 2, WARN mode): wrap every query with a client
		// extension that flags class-A model access without a tenantId filter from
		// tenant-scoped requests. Returning the extended client from the ctor makes
		// it the injected instance; model accessors and lifecycle proxy to the base.
		return this.$extends(createTenantIsolationExtension(this.cls)) as unknown as this;
	}

	async onModuleDestroy() {
		await this.$disconnect();
	}
}
