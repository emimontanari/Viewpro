import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
	TEST_WORKER_COUNT,
	maintenanceDatabaseUrl,
	templateDatabaseUrl,
	workerDatabaseName,
} from "./worker-databases";

/**
 * Prepares one database per worker before any test file runs.
 *
 * Migrations are applied once to the template database and each worker
 * database is cloned from it with CREATE DATABASE ... TEMPLATE, which copies
 * files rather than replaying every migration. Cloning N databases therefore
 * costs roughly one migration run, not N.
 */
export default async function setup() {
	const template = templateDatabaseUrl();

	execFileSync(resolve(process.cwd(), "node_modules/.bin/prisma"), ["migrate", "deploy"], {
		cwd: process.cwd(),
		stdio: "pipe",
		env: { ...process.env, DATABASE_URL: template, DIRECT_URL: template },
	});

	const maintenance = new PrismaClient({
		datasources: { db: { url: maintenanceDatabaseUrl() } },
	});

	try {
		const templateName = new URL(template).pathname.replace(/^\//, "");

		for (let poolId = 1; poolId <= TEST_WORKER_COUNT; poolId += 1) {
			const name = workerDatabaseName(poolId);

			// CREATE ... TEMPLATE refuses to run while anything is connected to
			// either database, so drop first and let Postgres reject a stale
			// connection loudly instead of cloning a half-open template.
			await maintenance.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}"`);
			await maintenance.$executeRawUnsafe(
				`CREATE DATABASE "${name}" TEMPLATE "${templateName}"`,
			);
		}
	} finally {
		await maintenance.$disconnect();
	}
}
