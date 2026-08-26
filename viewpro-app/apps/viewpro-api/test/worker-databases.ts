/**
 * One database per Vitest worker.
 *
 * Suites here clean shared tables between cases, which is only correct if the
 * suite owns the whole database. Sharing one database made that false between
 * files, so the config pinned `fileParallelism: false` while waiting for
 * exactly this.
 *
 * Giving each worker its own database makes the assumption true again: a
 * suite's cleanup can only reach the database its own worker owns.
 */

const DEFAULT_BASE_URL =
  'postgresql://viewpro_platform:viewpro_platform@localhost:5434/viewpro_platform_test'

/**
 * Worker slots, and therefore databases, to prepare.
 *
 * Two, matching apps/api. See the note there: four is measurably faster but
 * pushed the whole `turbo test` run past the retries often enough to matter.
 */
export const TEST_WORKER_COUNT = Number(process.env.VIEWPRO_PLATFORM_TEST_WORKERS ?? 2)

/** Base URL every derived database name is built from. */
export function baseDatabaseUrl(): string {
  return process.env.VIEWPRO_PLATFORM_TEST_BASE_DATABASE_URL ?? DEFAULT_BASE_URL
}

function withDatabaseName(url: string, databaseName: string): string {
  const parsed = new URL(url)
  parsed.pathname = `/${databaseName}`
  return parsed.toString()
}

function baseDatabaseName(): string {
  return new URL(baseDatabaseUrl()).pathname.replace(/^\//, '')
}

/**
 * The database migrations are applied to once. Worker databases are cloned from
 * it, so it is never connected to during a run.
 */
export function templateDatabaseUrl(): string {
  return baseDatabaseUrl()
}

/**
 * Maintenance connection used only to CREATE/DROP the worker databases.
 * `postgres` is the conventional database that always exists.
 */
export function maintenanceDatabaseUrl(): string {
  return withDatabaseName(baseDatabaseUrl(), 'postgres')
}

export function workerDatabaseName(poolId: number): string {
  return `${baseDatabaseName()}_w${poolId}`
}

export function workerDatabaseUrl(poolId: number): string {
  return withDatabaseName(baseDatabaseUrl(), workerDatabaseName(poolId))
}

/**
 * The slot this process is running in. Vitest numbers pool ids from 1 and
 * reuses them as workers are recycled, so it maps to a stable database.
 * Falls back to slot 1 when Vitest is not the caller.
 */
export function currentPoolId(): number {
  const poolId = Number(process.env.VITEST_POOL_ID)
  if (!Number.isInteger(poolId) || poolId < 1) return 1
  return Math.min(poolId, TEST_WORKER_COUNT)
}
