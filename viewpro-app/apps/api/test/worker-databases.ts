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
 * Worker slots, and therefore databases, to prepare.
 *
 * Four. This was capped at two while the e2e suites cycled a server socket per
 * request, which made four unreliable — 1 run in 3 failed under `turbo test`
 * even with `retry: 2`. Letting the apps listen once (#404) removed that, and
 * four now passes 10 of 10 here and 7 of 7 under `turbo test`, both with
 * `--retry=0`.
 *
 * It buys the inner loop, not CI: running this suite alone drops from ~59s to
 * ~35s, while a full `turbo test` stays at ~90s either way, because eight
 * concurrent tasks already saturate the machine. Raise it further only with the
 * same two measurements — repeated `--retry=0` runs, and wall clock for both
 * shapes — since more slots also mean more databases to clone at startup.
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
