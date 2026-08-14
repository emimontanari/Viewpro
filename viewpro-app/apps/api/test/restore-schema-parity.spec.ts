import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { foldMigrations, validateMigrationDirectory } from '../../../scripts/restore-drill/migration-contract.mjs'

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const fixtureRoot = join(appRoot, 'scripts/restore-drill/fixtures')
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

afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true })
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
