import { spawn } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { foldMigrations } from './migration-contract.mjs'
const DEFAULT_TIMEOUT_MS = 5_000; const KILL_GRACE_MS = 250; const LEDGER_LIMIT = 1_000
const ALLOWED_SCHEMAS = new Set(['public', 'audit'])
const ENV_KEYS = ['LANG', 'LC_ALL', 'PATH', 'PGCHANNELBINDING', 'PGDATABASE', 'PGHOST', 'PGPASSFILE', 'PGPORT', 'PGSSLROOTCERT', 'PGSSLMODE', 'PGUSER', '__CF_USER_TEXT_ENCODING']
const CATALOG_SQL = 'SET default_transaction_read_only = on;\nSELECT n.nspname, c.relname, c.relkind\nFROM pg_catalog.pg_class AS c\nJOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace\nORDER BY n.nspname, c.relname, c.relkind;\n'
const LEDGER_SQL = `SET default_transaction_read_only = on;\nSELECT migration_name, started_at, finished_at, rolled_back_at\nFROM "_prisma_migrations"\nORDER BY started_at, migration_name\nLIMIT ${LEDGER_LIMIT};\n`
const REPOSITORY_ROOT = fileURLToPath(new URL('../..', import.meta.url))
function error(code) { const failure = new Error(code); failure.code = code; return failure }
function childEnv() { return Object.fromEntries(ENV_KEYS.flatMap((key) => process.env[key] === undefined ? [] : [[key, process.env[key]]])) }
function schemaOf(name) { return /^"((?:""|[^"])*)"\./.exec(name)?.[1] }
function nameOf(schema, name) { return `"${schema.replaceAll('"', '""')}"."${name.replaceAll('"', '""')}"` }
function migrationNames(directory) { const names = readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort((left, right) => left < right ? -1 : left > right ? 1 : 0); if (!names.length) throw error('migration_path_invalid'); return names }
function parseCatalog(raw, schemas) { const actual = new Set()
  for (const line of raw.split('\n').filter(Boolean)) { const fields = line.split('\t'); if (fields.length !== 3 || !fields.every(Boolean)) throw error('command_output_invalid'); if (['r', 'p'].includes(fields[2]) && schemas.has(fields[0]) && (fields[0] !== 'public' || fields[1] !== '_prisma_migrations')) actual.add(nameOf(fields[0], fields[1])) } return actual }
function parseLedger(raw, expected) {
  const ledger = { applied: 0, rolledBack: 0, incomplete: 0 }; const names = []; const rows = raw.split('\n').filter(Boolean)
  if (rows.length >= LEDGER_LIMIT) throw error('ledger_output_invalid')
  for (const row of rows) { const fields = row.split('\t'); if (fields.length !== 4) throw error('command_output_invalid'); names.push(fields[0]); if (fields[3]) ledger.rolledBack += 1; else if (fields[2]) ledger.applied += 1; else ledger.incomplete += 1 } return { ledger, exact: names.length === expected.length && names.every((name, index) => name === expected[index]) }
}
function execute(spawnProcess, executable, sql, timeoutMs) {
  return new Promise((resolve, reject) => {
    let child
    try {
      child = spawnProcess(executable, ['-X', '-w', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-F', '\t'], { env: childEnv(), shell: false })
    } catch {
      reject(error('command_failed'))
      return
    }
    let stdout = ''
    let settled = false
    let grace
    let closeDrain
    let terminate
    let failed = false
    let exited = false
    let exitCode
    let exitSignal
    let stopping = false
    const stop = () => {
      if (settled || stopping) return
      stopping = true
      if (!exited) {
        grace = setTimeout(() => { if (!settled && !exited) child.kill('SIGKILL') }, KILL_GRACE_MS)
        child.kill('SIGTERM')
      }
    }
    const interrupt = () => { failed = true; stop() }
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(terminate); clearTimeout(grace); clearTimeout(closeDrain)
      process.removeListener('SIGTERM', interrupt); process.removeListener('SIGINT', interrupt)
      !failed && exitCode === 0 && !exitSignal ? resolve(stdout) : reject(error('command_failed'))
    }
    child.stdout?.on('data', (chunk) => { stdout += chunk })
    child.stderr?.on('data', () => {})
    child.once('error', () => { failed = true })
    child.once('exit', (code, signal) => {
      exited = true; exitCode = code; exitSignal = signal
      closeDrain = setTimeout(() => {
        failed = true
        child.stdin?.destroy?.(); child.stdout?.destroy?.(); child.stderr?.destroy?.()
        finish()
      }, KILL_GRACE_MS)
    })
    child.once('close', (code, signal) => { if (!exited) { exitCode = code; exitSignal = signal }; finish() })
    terminate = setTimeout(() => { failed = true; stop() }, timeoutMs)
    process.on('SIGTERM', interrupt); process.on('SIGINT', interrupt)
    child.stdin?.once?.('error', interrupt)
    child.stdin?.end(sql)
  })
}
function receipt(expected, actual, ledger, ledgerExact) { const missing = [...expected].filter((name) => !actual.has(name)).sort(); const unexpectedCount = [...actual].filter((name) => !expected.has(name)).length
  const pass = missing.length === 0 && unexpectedCount === 0 && ledgerExact && ledger.rolledBack === 0 && ledger.incomplete === 0; return { exitCode: pass ? 0 : 1, output: { pass, expectedCount: expected.size, actualCount: actual.size, missing, unexpectedCount, ledger } } }
function failure(code) { return { exitCode: 2, output: { pass: false, error: code } } }
export async function runParity({ migrationDir, repositoryRoot, schemas, psqlPath }, testDependencies = {}) {
  if (!Array.isArray(schemas) || schemas.length === 0 || schemas.some((schema) => typeof schema !== 'string' || !ALLOWED_SCHEMAS.has(schema))) return failure('schema_invalid')
  if (typeof psqlPath !== 'string' || !psqlPath) return failure('command_failed')
  const selected = new Set(schemas)
  try {
    const tables = foldMigrations(migrationDir, { repositoryRoot }).tables; const migrations = migrationNames(migrationDir)
    const expected = new Set(tables.filter((name) => selected.has(schemaOf(name))))
    const timeoutMs = testDependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const spawnProcess = testDependencies.spawnProcess ?? spawn
    const actual = parseCatalog(await execute(spawnProcess, psqlPath, CATALOG_SQL, timeoutMs), selected)
    const { ledger, exact } = parseLedger(await execute(spawnProcess, psqlPath, LEDGER_SQL, timeoutMs), migrations)
    return receipt(expected, actual, ledger, exact)
  } catch (caught) {
    return failure(caught?.code ?? 'command_failed')
  }
}
function parseArguments(argv) {
  const values = { schemas: [] }
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]
    const value = argv[++index]
    if (!value || !['--migration-dir', '--schema', '--psql'].includes(key)) throw error('arguments_invalid')
    if (key === '--schema') values.schemas.push(value)
    else if (values[key]) throw error('arguments_invalid')
    else values[key] = value
  }
  if (!values['--migration-dir'] || !values['--psql'] || values.schemas.length === 0) throw error('arguments_invalid')
  return { migrationDir: values['--migration-dir'], schemas: values.schemas, psqlPath: values['--psql'] }
}
async function main() {
  try {
    const { migrationDir, schemas, psqlPath } = parseArguments(process.argv.slice(2))
    const result = await runParity({ migrationDir, repositoryRoot: REPOSITORY_ROOT, schemas, psqlPath })
    process.stdout.write(`${JSON.stringify(result.output)}\n`)
    process.exitCode = result.exitCode
  } catch (caught) {
    process.stdout.write(`${JSON.stringify(failure(caught?.code ?? 'arguments_invalid').output)}\n`)
    process.exitCode = 2
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main()
