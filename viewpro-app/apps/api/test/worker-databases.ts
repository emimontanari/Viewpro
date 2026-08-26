/**
 * One database per Vitest worker.
 *
 * Every suite here cleans up with unfiltered `deleteMany()` on a hand-ordered
 * list of tables, which is only correct if the suite owns the whole database.
 * Sharing one database made that assumption false between files, so the suites
 * were forced to run serially (`fileParallelism: false`).
 *
 * Giving each worker its own database makes the assumption true again: a
 * suite's cleanup can only reach the database its own worker owns. The 24
 * files that delete unfiltered become correct by construction rather than by
 * maintaining their table lists, and the files can run in parallel.
 */

const DEFAULT_BASE_URL =
	"postgresql://viewpro:viewpro@localhost:5432/viewpro_test?schema=public";

/**
 * Worker slots, and therefore databases, to prepare. Kept small on purpose:
 * every slot is a real database that global setup has to clone before the run
 * starts, so more slots buy parallelism at a fixed startup cost.
 */
export const TEST_WORKER_COUNT = Number(process.env.VIEWPRO_TEST_WORKERS ?? 4);

/** Base URL every derived database name is built from. */
export function baseDatabaseUrl(): string {
	return process.env.VIEWPRO_TEST_BASE_DATABASE_URL ?? DEFAULT_BASE_URL;
}

function withDatabaseName(url: string, databaseName: string): string {
	const parsed = new URL(url);
	parsed.pathname = `/${databaseName}`;
	return parsed.toString();
}

function baseDatabaseName(): string {
	return new URL(baseDatabaseUrl()).pathname.replace(/^\//, "");
}

/**
 * The database migrations are applied to once. Worker databases are cloned
 * from it, so it is never connected to during a run.
 */
export function templateDatabaseUrl(): string {
	return baseDatabaseUrl();
}

/**
 * Maintenance connection used only to CREATE/DROP the worker databases.
 * `postgres` is the conventional database that always exists.
 */
export function maintenanceDatabaseUrl(): string {
	return withDatabaseName(baseDatabaseUrl(), "postgres");
}

export function workerDatabaseName(poolId: number): string {
	return `${baseDatabaseName()}_w${poolId}`;
}

export function workerDatabaseUrl(poolId: number): string {
	return withDatabaseName(baseDatabaseUrl(), workerDatabaseName(poolId));
}

/**
 * The slot this process is running in. Vitest numbers pool ids from 1 and
 * reuses them as workers are recycled, so it maps to a stable database.
 * Falls back to slot 1 when Vitest is not the caller (e.g. a direct script).
 */
export function currentPoolId(): number {
	const poolId = Number(process.env.VITEST_POOL_ID);
	if (!Number.isInteger(poolId) || poolId < 1) return 1;
	return Math.min(poolId, TEST_WORKER_COUNT);
}
