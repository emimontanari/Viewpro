/* oxlint-disable vitest/expect-expect -- assertions live in the sanitizedExit2/cliExit2 helpers, which the rule cannot see through */
/* oxlint-disable promise/always-return -- the .then() here records a settled flag for a fake-timer assertion */
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { foldMigrations, validateMigrationDirectory } from '../../../scripts/restore-drill/migration-contract.mjs'
import { runParity } from '../../../scripts/restore-drill/schema-parity.mjs'

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const fixtureRoot = join(appRoot, 'scripts/restore-drill/fixtures')
const fakeSource = join(fixtureRoot, 'fake-psql.mjs')
const catalogSql = 'SET default_transaction_read_only = on;\nSELECT n.nspname, c.relname, c.relkind\nFROM pg_catalog.pg_class AS c\nJOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace\nORDER BY n.nspname, c.relname, c.relkind;\n'
const ledgerSql = 'SET default_transaction_read_only = on;\nSELECT migration_name, started_at, finished_at, rolled_back_at\nFROM "_prisma_migrations"\nORDER BY started_at, migration_name\nLIMIT 1000;\n'
const childEnv = { LANG: 'C', LC_ALL: 'C', PATH: '/synthetic/bin', PGCHANNELBINDING: 'require', PGDATABASE: 'restore.invalid', PGHOST: 'restore.invalid', PGPASSFILE: '/synthetic/pgpass', PGPORT: '6543', PGSSLROOTCERT: '/synthetic/root.crt', PGSSLMODE: 'verify-full', PGUSER: 'restore-user', __CF_USER_TEXT_ENCODING: process.env.__CF_USER_TEXT_ENCODING ?? '0x0:0:0' }
const childEnvDigest = Object.fromEntries(Object.entries(childEnv).sort().map(([key, value]) => [key, createHash('sha256').update(value).digest('hex')]))
const runnerEnv = Object.fromEntries([...Object.keys(childEnv), 'ARBITRARY_PARENT', 'PGPASSWORD'].map((key) => [key, process.env[key]]))
const [defaultTimeoutMs, killGraceMs] = [5_000, 250]
const temporary: string[] = []

function sandbox() {
  mkdirSync(fixtureRoot, { recursive: true })
  const root = mkdtempSync(join(fixtureRoot, '.migration-contract-'))
  const outside = mkdtempSync(join(tmpdir(), 'migration-contract-'))
  temporary.push(root, outside)
  return { root, outside }
}

function localDirectory(prefix: string) {
  const path = mkdtempSync(join(fixtureRoot, prefix))
  temporary.push(path)
  return path
}

function symlinkPath(target: string, prefix: string) {
  const path = localDirectory(prefix)
  rmSync(path, { recursive: true })
  symlinkSync(target, path)
  return path
}

function migration(root: string, name: string, sql: string) {
  const path = join(root, name, 'migration.sql')
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, sql)
}

function codeOf(action: () => unknown) {
  try { action() } catch (error) { return (error as { code: string }).code }
}

function sanitizedExit2(result: unknown, error: string) { expect(result).toEqual({ exitCode: 2, output: { pass: false, error } }); expect(JSON.stringify(result)).not.toMatch(/private|DROP|restore\.invalid|hostile|pid|SIGTERM|stderr/i) }
function cliExit2(result: { status: number | null, stdout: string, stderr: string }, error: string) { expect(result).toEqual(expect.objectContaining({ status: 2, stdout: `{"pass":false,"error":"${error}"}\n`, stderr: '' })); expect(`${result.stdout}${result.stderr}`).not.toMatch(/private|DROP|restore\.invalid|hostile|pid|SIGTERM|stderr/i) }
function cliNoSpawn(state: { directory: string, migrationDir: string, psqlPath: string }, args: string[], error: string) { const calls = join(state.directory, 'calls.jsonl'); const before = existsSync(calls) ? readFileSync(calls, 'utf8') : ''; cliExit2(runParityCli(state, args), error); expect(existsSync(calls) ? readFileSync(calls, 'utf8') : '').toBe(before) }
function catalogRows(migrationDir: string) { return foldMigrations(migrationDir, { repositoryRoot: appRoot }).tables.map((table, index) => { const [, schema, name] = /"([^"]+)"\."([^"]+)"/.exec(table) ?? []; return `${schema}\t${name}\t${index ? 'r' : 'p'}\n` }).join('') }
function appliedLedger(migrationDir: string) { return readdirSync(migrationDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().map((name, index) => `${name}\t${index}\tfinished\t\n`).join('') }
function resistantChild(signals: string[], output = '', cooperative = false, trailing = '') {
  const child = new EventEmitter() as EventEmitter & { stdin: { end: () => void }, stdout: EventEmitter, exitCode: null, signalCode: null, killed: boolean, kill: (signal: string) => boolean }
  child.stdin = { end: () => {} }; child.stdout = new EventEmitter(); child.exitCode = null; child.signalCode = null; child.killed = false
  child.kill = (signal) => { signals.push(signal); if (signal === 'SIGKILL' || (cooperative && signal === 'SIGTERM')) { child.killed = true; child.signalCode = signal; queueMicrotask(() => { child.emit('exit', null, signal); child.emit('close', null, signal) }) }; return true }; if (output) queueMicrotask(() => { child.stdout.emit('data', output); child.emit('exit', 0, null); if (trailing) child.stdout.emit('data', trailing); child.emit('close', 0, null) }); return child
}
function parityFixture() {
  const directory = localDirectory('.parity-'); const migrationDir = join(directory, 'migrations'); const psqlPath = join(directory, 'psql.mjs')
  migration(migrationDir, '20240101000000_init', 'CREATE TABLE public.alpha (id text); CREATE TABLE public.beta (id text); CREATE TABLE audit."Camel" (id text);')
  writeFileSync(join(directory, 'expected-catalog.sql'), catalogSql); writeFileSync(join(directory, 'expected-ledger.sql'), ledgerSql); writeFileSync(join(directory, 'exact-required.txt'), 'enabled')
  const catalog = catalogRows(migrationDir); writeFileSync(join(directory, 'catalog.tsv'), `${catalog}public\tignored_view\tv\npublic\tignored_sequence\tS\n`); writeFileSync(join(directory, 'ledger.tsv'), '20240101000000_init\tstarted\tfinished\t\n')
  writeFileSync(psqlPath, `#!${process.execPath}\n${readFileSync(fakeSource, 'utf8').replace(/^#!.*\n/, '')}`); chmodSync(psqlPath, 0o755); return { catalog, directory, migrationDir, psqlPath }
}
function runParityCli(state: { migrationDir: string, psqlPath: string }, args = ['--migration-dir', state.migrationDir, '--schema', 'public', '--schema', 'audit', '--psql', state.psqlPath]) { return spawnSync(process.execPath, [join(appRoot, 'scripts/restore-drill/schema-parity.mjs'), ...args], { encoding: 'utf8', env: process.env }) }
function runEscapedParityCli() { const directory = localDirectory('.escaped path-'); for (const name of ['migration-contract.mjs', 'schema-parity.mjs']) writeFileSync(join(directory, name), readFileSync(join(appRoot, 'scripts/restore-drill', name))); return spawnSync(process.execPath, [join(directory, 'schema-parity.mjs')], { encoding: 'utf8', env: process.env }) }
beforeEach(() => Object.assign(process.env, childEnv, { ARBITRARY_PARENT: 'synthetic-denied', PGPASSWORD: 'synthetic-denied' }))
afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true })
  for (const [key, value] of Object.entries(runnerEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
})

describe('restore migration contract', () => {
  it('folds ordered create/drop, rename, schema move, and quoted identifiers deterministically', () => {
    const { root } = sandbox()
    migration(root, '20240102000000_cleanup', 'DROP TABLE IF EXISTS public.discarded;')
    migration(root, '20240101000000_init', `
      CREATE TABLE "Audit"."Camel" (id text);
      ALTER TABLE "Audit"."Camel" SET SCHEMA public;
      CREATE TABLE Audit."Archive" (id text);
      CREATE TABLE public.old_table (id text);
      ALTER TABLE public.old_table RENAME TO "Thing";
      CREATE TABLE public.discarded (id text);
      -- CREATE TABLE public.ignored (id text);
      /* CREATE TABLE public.ignored_block_comment (id text); */
      SELECT 'CREATE TABLE public.ignored_too (id text)';
      SELECT $sql$ CREATE TABLE public.ignored_dollar_quote (id text); $sql$;
    `)
    const first = foldMigrations(root, { repositoryRoot: appRoot })
    expect(first).toEqual(foldMigrations(root, { repositoryRoot: appRoot }))
    expect(first.tables).toEqual(['"audit"."Archive"', '"public"."Camel"', '"public"."Thing"'])
  })

  it('rejects procedural or dynamic table shaping with a stable error code', () => {
    const { root } = sandbox()
    migration(root, '20240101000000_dynamic', "DO $$ BEGIN EXECUTE 'CREATE TABLE public.hidden (id text)'; END $$;")
    expect(codeOf(() => foldMigrations(root, { repositoryRoot: appRoot }))).toBe('migration_sql_unsupported')
  })

  it('rejects static table shaping inside a function body', () => {
    const { root } = sandbox()
    migration(root, '20240101000000_function', 'CREATE FUNCTION public.hidden() RETURNS void AS $$ BEGIN CREATE TABLE public.hidden_table (id text); END $$ LANGUAGE plpgsql;')
    expect(() => foldMigrations(root, { repositoryRoot: appRoot })).toThrow('migration_sql_unsupported')
  })

  it('rejects procedures and calls while allowing non-procedural dollar strings', () => {
    for (const sql of ["CREATE PROCEDURE public.hidden() LANGUAGE plpgsql AS $$ BEGIN EXECUTE 'CREATE TABLE public.hidden_table (id text)'; END $$;", "CREATE PROCEDURE public.hidden() LANGUAGE plpgsql AS 'BEGIN EXECUTE ''CREATE TABLE public.hidden_table (id text)''; END';", 'CALL public.hidden();']) {
      const { root } = sandbox()
      migration(root, '20240101000000_procedure', sql)
      expect.soft(codeOf(() => foldMigrations(root, { repositoryRoot: appRoot }))).toBe('migration_sql_unsupported')
    }
    const { root } = sandbox()
    migration(root, '20240101000000_safe', 'SELECT $$ EXECUTE $$; CREATE TABLE public.actual (id text);')
    expect(foldMigrations(root, { repositoryRoot: appRoot }).tables).toEqual(['"public"."actual"'])
  })

  it('ignores DDL inside escape strings with escaped quotes', () => {
    const { root } = sandbox()
    migration(root, '20240101000000_escape', `SELECT E'CREATE TABLE public.ignored \\'quote'; CREATE TABLE public.actual (id text);`)
    expect(foldMigrations(root, { repositoryRoot: appRoot }).tables).toEqual(['"public"."actual"'])
  })

  it('uses locale-independent lexical migration ordering', () => {
    const { root } = sandbox()
    migration(root, 'B_create', 'CREATE TABLE public.ordered (id text);')
    migration(root, 'a_drop', 'DROP TABLE public.ordered;')
    expect(foldMigrations(root, { repositoryRoot: appRoot }).tables).toEqual([])
  })

  it('fails closed when expected tables differ from the migration fold', () => {
    const { root } = sandbox()
    migration(root, '20240101000000_init', 'CREATE TABLE public.actual (id text);')
    expect(codeOf(() => foldMigrations(root, { repositoryRoot: appRoot, expectedTables: ['"public"."missing"'] }))).toBe('expected_tables_invalid')
  })

  it('folds the exact 23 product and 6 platform repository tables', () => {
    expect(foldMigrations(join(appRoot, 'apps/api/prisma/migrations'), { repositoryRoot: appRoot }).tables).toEqual([
      '"public"."analytics_events"', '"public"."document_requests"', '"public"."document_versions"', '"public"."documents"',
      '"public"."email_verification_tokens"', '"public"."movements"', '"public"."notifications"', '"public"."owner_invitations"',
      '"public"."password_reset_tokens"', '"public"."platform_command_log"', '"public"."platform_outbox_events"', '"public"."property_agents"',
      '"public"."property_asset_images"', '"public"."property_asset_owners"', '"public"."property_assets"', '"public"."property_engagements"',
      '"public"."refresh_tokens"', '"public"."status_change_requests"', '"public"."team_invitations"', '"public"."tenant_memberships"',
      '"public"."tenant_movement_outcome_labels"', '"public"."tenants"', '"public"."users"',
    ])
    expect(foldMigrations(join(appRoot, 'apps/viewpro-api/prisma/migrations'), { repositoryRoot: appRoot }).tables).toEqual([
      '"public"."Operator"', '"public"."platform_audit_log"', '"public"."platform_ingest_cursor"',
      '"public"."platform_mirror_events"', '"public"."platform_tenants"', '"public"."tenant_payments"',
    ])
  })

  it('normalizes a missing migration source to the public path error', () => {
    const { root } = sandbox()
    mkdirSync(join(root, '20240101000000_missing'), { recursive: true })
    expect(codeOf(() => foldMigrations(root, { repositoryRoot: appRoot }))).toBe('migration_path_invalid')
  })

  it('rejects missing, non-directory, traversal, wrong-root, symlink, and metacharacter paths', () => {
    const { root, outside } = sandbox()
    const nested = localDirectory('.nested-')
    const fileLinked = localDirectory('.file-linked-')
    const meta = `${localDirectory('.meta-')};unsafe`
    const newline = localDirectory('.newline-\n')
    const linkedRoot = symlinkPath(root, '.root-link-')
    mkdirSync(join(fileLinked, '20240101000000_linked'), { recursive: true })
    mkdirSync(meta, { recursive: true })
    writeFileSync(join(outside, 'migration.sql'), 'CREATE TABLE public.outside (id text);')
    symlinkSync(outside, join(nested, '20240101000000_nested'))
    symlinkSync(join(outside, 'migration.sql'), join(fileLinked, '20240101000000_linked', 'migration.sql'))
    temporary.push(meta)
    const traversal = `${root}/${relative(root, outside)}`
    for (const candidate of [join(fixtureRoot, '.missing'), join(appRoot, 'package.json'), traversal, outside, linkedRoot, nested, fileLinked, meta, newline]) {
      expect(codeOf(() => validateMigrationDirectory(candidate, { repositoryRoot: appRoot }))).toBe('migration_path_invalid')
    }
  })
})
describe('restore schema parity', () => {
  const input = () => ({ ...parityFixture(), repositoryRoot: appRoot, schemas: ['public', 'audit'] })
  it('consumes PR2b1 and sends two exact read-only queries across allowed schemas', async () => {
    const first = { ...input(), schemas: ['public'] }; const second = { ...first, schemas: ['audit'] }
    const primary = await runParity(first); const secondary = await runParity(second)
    const calls = readFileSync(join(first.psqlPath, '..', 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
    expect(calls.map((call) => call.input)).toEqual([catalogSql, ledgerSql, catalogSql, ledgerSql])
    expect(calls.map((call) => call.argv)).toEqual(Array.from({ length: 4 }, () => ['-X', '-w', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-F', '\t']))
    expect(calls.map((call) => call.env)).toEqual(Array.from({ length: 4 }, () => childEnvDigest))
    expect(calls.every((call) => !call.startupAttempt && !call.ddlAttempt)).toBe(true)
    expect(primary).toMatchObject({ exitCode: 0, output: { pass: true, expectedCount: 2, actualCount: 2, missing: [], unexpectedCount: 0 } })
    expect(secondary).toMatchObject({ exitCode: 0, output: { pass: true, expectedCount: 1, actualCount: 1, missing: [], unexpectedCount: 0 } })
    for (const schemas of [['private'], ['public; DROP TABLE'], ['public\n']]) sanitizedExit2(await runParity({ ...first, schemas }), 'schema_invalid')
    sanitizedExit2(await runParity({ ...first, migrationDir: join(first.directory, 'missing;path') }), 'migration_path_invalid')
    expect(readFileSync(join(first.psqlPath, '..', 'calls.jsonl'), 'utf8').trim().split('\n')).toHaveLength(4)
    const timeoutMs = 250; const spawned: unknown[][] = []; await runParity(first, { timeoutMs, spawnProcess: (...args) => { spawned.push(args); return spawn(...args) } })
    expect(spawned).toEqual(Array.from({ length: 2 }, () => [first.psqlPath, ['-X', '-w', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-F', '\t'], expect.objectContaining({ env: childEnv, shell: false })]))
    for (const [, , options] of spawned) { expect(options).not.toHaveProperty('timeout'); expect(options).not.toHaveProperty('killSignal') }
  })
  it('frames required ledger fields and rejects saturation or free-form logs', async () => {
    const state = input(); const ledger = join(state.psqlPath, '..', 'ledger.tsv')
    for (const [rows, expected, exitCode] of [['init\tstarted\tfinished\t\nrolled\tstarted\tfinished\trolled\nincomplete\tstarted\t\t\n', { applied: 1, rolledBack: 1, incomplete: 1 }, 1], ['x\tstarted\tfinished\t\n'.repeat(999), { applied: 999, rolledBack: 0, incomplete: 0 }, 1], ['', { applied: 0, rolledBack: 0, incomplete: 0 }, 1], ['x\tstarted\tfinished\t\n'.repeat(1000), 'ledger_output_invalid'], ['hostile\tstarted\tfinished\t\tprivate\tlog\n', 'command_output_invalid'], ['bad\n', 'command_output_invalid']]) {
      writeFileSync(ledger, rows); const result = await runParity(state); if (typeof expected === 'string') sanitizedExit2(result, expected); else expect(result).toMatchObject({ exitCode, output: { ledger: expected } })
    }
  })
  it('requires migration source, ignores Prisma metadata, and compares application chronology', async () => {
    const state = input(); const ledger = join(state.psqlPath, '..', 'ledger.tsv'); const empty = localDirectory('.empty-')
    sanitizedExit2(await runParity({ ...state, migrationDir: empty }), 'migration_path_invalid')
    writeFileSync(join(state.psqlPath, '..', 'catalog.tsv'), `${state.catalog}public\t_prisma_migrations\tr\n`)
    expect(await runParity(state)).toMatchObject({ exitCode: 0, output: { pass: true, actualCount: 3 } })
    migration(state.migrationDir, '20240102000000_empty', '-- no table')
    const first = '20240101000000_init\t2024-01-02\tfinished\t\n'; const second = '20240102000000_empty\t2024-01-01\tfinished\t\n'
    for (const rows of ['', first, `${first}unexpected\tstart\tfinished\t\n`, `${first}${first}`, `${second}${first}`]) { writeFileSync(ledger, rows); expect.soft((await runParity(state)).exitCode).toBe(1) }
    writeFileSync(ledger, `${first}${second}`); expect(await runParity(state)).toMatchObject({ exitCode: 0, output: { pass: true, ledger: { applied: 2, rolledBack: 0, incomplete: 0 } } })
  })
  it('returns deterministic canonical 0/1/2 receipts without runtime identifier leakage', { timeout: 8_000 }, async () => {
    const state = input(); const directory = join(state.psqlPath, '..')
    expect(await runParity(state)).toMatchObject({ exitCode: 0, output: { pass: true } })
    writeFileSync(join(directory, 'catalog.tsv'), 'public\truntime_only\tr\n')
    const mismatch = await runParity(state); expect(mismatch).toMatchObject({ exitCode: 1, output: { pass: false, missing: ['"audit"."Camel"', '"public"."alpha"', '"public"."beta"'], unexpectedCount: 1 } }); expect(JSON.stringify(await runParity(state))).toBe(JSON.stringify(mismatch)); expect(JSON.stringify(mismatch)).not.toContain('runtime_only')
    const mismatchCli = runParityCli(state); expect(mismatchCli.status).toBe(1); expect(mismatchCli.stderr).toBe(''); expect(mismatchCli.stdout).toBe('{"pass":false,"expectedCount":3,"actualCount":1,"missing":["\\"audit\\".\\"Camel\\"","\\"public\\".\\"alpha\\"","\\"public\\".\\"beta\\""],"unexpectedCount":1,"ledger":{"applied":1,"rolledBack":0,"incomplete":0}}\n'); expect(runParityCli(state).stdout).toBe(mismatchCli.stdout)
    writeFileSync(join(directory, 'catalog.tsv'), state.catalog); writeFileSync(join(directory, 'ledger.tsv'), 'hostile-name\tfinished\t\thostile-log\n'); expect(JSON.stringify(await runParity(state))).not.toMatch(/hostile-name|hostile-log/)
    writeFileSync(join(directory, 'catalog.tsv'), 'malformed\n'); writeFileSync(join(directory, 'stderr.txt'), 'hostile-id https://invalid.test'); sanitizedExit2(await runParity(state), 'command_output_invalid')
    const malformed = await runParity(state); sanitizedExit2(malformed, 'command_output_invalid'); expect(JSON.stringify(await runParity(state))).toBe(JSON.stringify(malformed)); const invalid = runParityCli(state); expect(invalid.status).toBe(2); expect(invalid.stdout).toBe('{"pass":false,"error":"command_output_invalid"}\n'); expect(runParityCli(state).stdout).toBe(invalid.stdout); expect(`${invalid.stdout}${invalid.stderr}`).not.toMatch(/hostile|invalid\.test/)
    writeFileSync(join(directory, 'catalog.tsv'), state.catalog); rmSync(join(directory, 'stderr.txt')); writeFileSync(join(directory, 'status.txt'), '9')
    cliExit2(runParityCli(state), 'command_failed'); sanitizedExit2(await runParity(state), 'command_failed'); sanitizedExit2(await runParity({ ...state, psqlPath: join(directory, 'missing') }), 'command_failed'); cliExit2(runParityCli({ ...state, psqlPath: join(directory, 'missing') }), 'command_failed'); sanitizedExit2(await runParity({ ...state, migrationDir: join(directory, 'missing;path') }), 'migration_path_invalid'); cliNoSpawn(state, ['--migration-dir', join(directory, 'missing;path'), '--schema', 'public', '--psql', state.psqlPath], 'migration_path_invalid')
  })
  it('emits byte-identical newline-terminated canonical raw stdout', () => {
    const state = input(); const first = runParityCli(state); const second = runParityCli(state)
    expect(first.status).toBe(0); expect(first.stderr).toBe(''); expect(second.stderr).toBe(''); expect(first.stdout).toBe(second.stdout)
    expect(first.stdout).toBe('{"pass":true,"expectedCount":3,"actualCount":3,"missing":[],"unexpectedCount":0,"ledger":{"applied":1,"rolledBack":0,"incomplete":0}}\n')
  })
  it('requires the package script and canonical CLI arguments', () => {
    expect(JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8')).scripts['restore:parity']).toBe('node scripts/restore-drill/schema-parity.mjs')
    const state = input(); for (const args of [[], ['--unknown'], ['--migration-dir'], ['--psql', 'a', '--psql', 'b'], ['--schema'], ['--schema', 'public', '--schema']]) cliNoSpawn(state, args, 'arguments_invalid')
    cliExit2(runEscapedParityCli(), 'arguments_invalid')
    cliNoSpawn(state, ['--migration-dir', state.migrationDir, '--schema', 'private', '--psql', state.psqlPath], 'schema_invalid')
  })
  it('emits complete product and platform repository receipts', async () => {
    for (const [migrationDir, count] of [[join(appRoot, 'apps/api/prisma/migrations'), 23], [join(appRoot, 'apps/viewpro-api/prisma/migrations'), 6]]) {
      const state = input(); writeFileSync(join(state.psqlPath, '..', 'catalog.tsv'), catalogRows(migrationDir)); writeFileSync(join(state.psqlPath, '..', 'ledger.tsv'), appliedLedger(migrationDir))
      expect(await runParity({ ...state, migrationDir })).toMatchObject({ exitCode: 0, output: { pass: true, expectedCount: count, actualCount: count, missing: [], unexpectedCount: 0 } }); const cli = runParityCli({ ...state, migrationDir }); expect(cli).toMatchObject({ status: 0 }); expect(JSON.parse(cli.stdout)).toMatchObject({ pass: true, expectedCount: count, actualCount: count, missing: [], unexpectedCount: 0 })
    }
  })
  it('maps targeted catalog and ledger child failures to bounded sanitized exit 2', async () => {
    for (const target of ['status-catalog-1', 'status-ledger-2', 'signal-catalog-1', 'signal-ledger-2']) {
      const state = input(); const directory = state.directory; const timeoutMs = 250; writeFileSync(join(directory, `${target}.txt`), target.startsWith('status') ? '9' : target.startsWith('signal') ? 'SIGTERM' : 'enabled')
      sanitizedExit2(await runParity(state, { timeoutMs }), 'command_failed')
    }
  })
  it('escalates deterministic catalog and ledger resistant children', async () => {
    for (const target of ['catalog', 'ledger']) {
      vi.useFakeTimers()
      try {
        const state = input(); const timeoutMs = 250; const signals: string[] = []; let call = 0
        const promise = runParity(state, { timeoutMs, spawnProcess: () => resistantChild(signals, target === 'ledger' && call++ === 0 ? state.catalog : '') })
        let settled = false; void promise.finally(() => { settled = true })
        await vi.advanceTimersByTimeAsync(timeoutMs); expect(signals).toEqual(['SIGTERM']); expect(settled).toBe(false)
        await vi.advanceTimersByTimeAsync(killGraceMs); sanitizedExit2(await promise, 'command_failed'); expect(signals).toEqual(['SIGTERM', 'SIGKILL']); expect(settled).toBe(true)
      } finally { vi.useRealTimers() }
    }
    vi.useFakeTimers()
    try {
      const state = input(); const signals: string[] = []; const promise = runParity(state, { timeoutMs: 250, spawnProcess: () => resistantChild(signals, '', true) }); let settled = false; void promise.finally(() => { settled = true })
      await vi.advanceTimersByTimeAsync(250 + killGraceMs + 1); sanitizedExit2(await promise, 'command_failed'); expect(signals).toEqual(['SIGTERM']); expect(settled).toBe(true)
    } finally { vi.useRealTimers() }
  })
  it('drains trailing catalog rows after exit before parsing on close', async () => {
    const state = input(); const rows = state.catalog.trim().split('\n'); let call = 0
    const result = await runParity(state, { spawnProcess: () => resistantChild([], call++ === 0 ? `${rows.shift()}\n` : '20240101000000_init\tstarted\tfinished\t\n', false, call === 1 ? `${rows.join('\n')}\n` : '') })
    expect(result).toEqual({ exitCode: 0, output: { pass: true, expectedCount: 3, actualCount: 3, missing: [], unexpectedCount: 0, ledger: { applied: 1, rolledBack: 0, incomplete: 0 } } })
  })
  it('bounds an exited child that never closes as sanitized exit 2', async () => {
    vi.useFakeTimers()
    try {
      const state = input(); const child = resistantChild([], ''); let result: unknown
      queueMicrotask(() => { child.stdout.emit('data', state.catalog); child.emit('exit', 0, null) })
      void runParity(state, { timeoutMs: killGraceMs, spawnProcess: () => child }).then((value) => { result = value })
      await vi.advanceTimersByTimeAsync(killGraceMs); sanitizedExit2(result, 'command_failed')
    } finally { vi.useRealTimers() }
  })
  it('reconciles rapid parent signals until the active child is reaped', async () => {
    vi.useFakeTimers()
    try {
      const state = input(); const signals: string[] = []; const before = process.listenerCount('SIGTERM')
      const promise = runParity(state, { timeoutMs: killGraceMs, spawnProcess: () => resistantChild(signals) })
      expect(process.listenerCount('SIGTERM')).toBe(before + 1); process.emit('SIGTERM'); process.emit('SIGINT')
      expect(signals).toEqual(['SIGTERM']); expect(process.listenerCount('SIGTERM')).toBe(before + 1)
      await vi.advanceTimersByTimeAsync(killGraceMs); sanitizedExit2(await promise, 'command_failed')
      expect(signals).toEqual(['SIGTERM', 'SIGKILL']); expect(process.listenerCount('SIGTERM')).toBe(before)
    } finally { vi.useRealTimers() }
  })
  it('normalizes a stdin EPIPE without an uncaught error', async () => {
    const state = input(); let call = 0
    const result = await runParity(state, { spawnProcess: () => {
      const child = resistantChild([], call++ ? '20240101000000_init\tfinished\t\n' : state.catalog)
      if (call === 1) child.stdin = Object.assign(new EventEmitter(), { end() { if (this.listenerCount('error')) this.emit('error', Object.assign(new Error('private EPIPE'), { code: 'EPIPE' })) } })
      return child
    } })
    sanitizedExit2(result, 'command_failed')
  })
  it('forwards parent SIGTERM and SIGINT to clean the active child', { timeout: 8_000 }, async () => {
    for (const signal of ['SIGTERM', 'SIGINT']) {
      const state = input(); const directory = state.directory; let psqlPid: number | undefined
      try {
        writeFileSync(join(directory, 'hang.txt'), 'enabled'); const cli = spawn(process.execPath, [join(appRoot, 'scripts/restore-drill/schema-parity.mjs'), '--migration-dir', state.migrationDir, '--schema', 'public', '--schema', 'audit', '--psql', state.psqlPath], { env: process.env }); let stdout = ''; let stderr = ''
        cli.stdout.on('data', (chunk) => { stdout += chunk }); cli.stderr.on('data', (chunk) => { stderr += chunk })
        while (!existsSync(join(directory, 'pid.txt'))) await new Promise((resolve) => setTimeout(resolve, 5)); psqlPid = Number(readFileSync(join(directory, 'pid.txt'), 'utf8')); cli.kill(signal)
        const status = await new Promise<number | null>((resolve) => cli.once('close', (code) => resolve(code))); cliExit2({ status, stdout, stderr }, 'command_failed'); expect(existsSync(join(directory, 'term.txt'))).toBe(true); expect(() => process.kill(psqlPid!, 0)).toThrow()
      } finally { if (psqlPid) try { process.kill(psqlPid, 'SIGKILL') } catch {} }
    }
  })
  it('makes the exact-byte fake suppress startup and reject DDL, signals, and hangs', { timeout: 8_000 }, async () => {
    const state = input(); const directory = join(state.psqlPath, '..')
    writeFileSync(join(directory, 'startup-output.txt'), 'startup\n'); writeFileSync(join(directory, 'reject-ddl.txt'), 'enabled')
    for (const sql of ['CREATE TEMP TABLE x(id int)', 'CREATE UNLOGGED TABLE x(id int)', 'ALTER TABLE x RENAME TO y', 'DROP TABLE x', 'TRUNCATE x', 'SELECT id INTO x FROM y', 'CREATE /*x*/ TABLE x(id int)']) expect(spawnSync(state.psqlPath, ['-X'], { env: childEnv, input: sql }).status).toBe(73)
    rmSync(join(directory, 'exact-required.txt')); for (const sql of ["SELECT 'CREATE TABLE x'", '-- CREATE TABLE x', '/* CREATE TABLE x */', 'SELECT "CREATE TABLE x"', 'SELECT $$CREATE TABLE x$$']) expect(spawnSync(state.psqlPath, ['-X'], { env: childEnv, input: sql }).status).toBe(0)
    expect(spawnSync(state.psqlPath, [], { env: childEnv, input: 'SELECT 1;' }).stdout.toString()).toContain('startup')
    writeFileSync(join(directory, 'signal.txt'), 'SIGTERM'); sanitizedExit2(await runParity(state), 'command_failed'); cliExit2(runParityCli(state), 'command_failed'); rmSync(join(directory, 'signal.txt'))
    writeFileSync(join(directory, 'hang.txt'), 'enabled'); const timed = await runParity(state, { timeoutMs: 250 }); sanitizedExit2(timed, 'command_failed'); expect(existsSync(join(directory, 'term.txt'))).toBe(true); const pid = Number(readFileSync(join(directory, 'pid.txt'), 'utf8')); expect(JSON.stringify(timed)).not.toContain(String(pid)); expect(() => process.kill(pid, 0)).toThrow(); rmSync(join(directory, 'hang.txt'))
    const hostile = join(directory, 'psql;touch shell-marker'); writeFileSync(hostile, readFileSync(state.psqlPath)); chmodSync(hostile, 0o755); expect(await runParity({ ...state, psqlPath: hostile })).toMatchObject({ exitCode: 0 }); expect(existsSync(join(directory, 'shell-marker'))).toBe(false)
    expect(readFileSync(join(directory, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse).every((call) => JSON.stringify(call.env) === JSON.stringify(childEnvDigest))).toBe(true)
  })
  it('bounds CLI default hang cleanup independently', { timeout: 8_000 }, () => {
    const state = input(); const directory = state.directory; writeFileSync(join(directory, 'hang.txt'), 'enabled')
    const before = existsSync(join(directory, 'calls.jsonl')) ? readFileSync(join(directory, 'calls.jsonl'), 'utf8').trim().split('\n').length : 0; const started = Date.now(); cliExit2(runParityCli(state), 'command_failed')
    expect(Date.now() - started).toBeLessThan(defaultTimeoutMs * 3); const pid = Number(readFileSync(join(directory, 'pid.txt'), 'utf8')); expect(readFileSync(join(directory, 'calls.jsonl'), 'utf8').trim().split('\n')).toHaveLength(before + 1); expect(() => process.kill(pid, 0)).toThrow()
  })
})
