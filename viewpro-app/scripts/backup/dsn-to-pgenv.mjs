#!/usr/bin/env node
// Splits a Postgres connection URI into the PG* variables libpq reads from the
// environment.
//
// Exists so the nightly backup never passes a DSN as a command argument. In
// argv the whole connection string — credentials included — sits in the
// runner's process table, where /proc/PID/cmdline is world-readable;
// /proc/PID/environ is not.
//
// Verified against pg_dump 17 before writing this: there is no PGURI variable,
// and neither PGDATABASE nor a libpq service file expands a connection URI.
// Only the individual PG* variables do, which is why this splits rather than
// forwards.
//
// Reads the DSN from the DSN environment variable, never from argv, and writes
// KEY=value lines to stdout. Exits non-zero rather than emitting a partial
// environment, so a caller that checks the status cannot dump against a
// half-configured connection.

const DEFAULT_PORT = '5432';
const DEFAULT_SSLMODE = 'require';
const SUPPORTED_SCHEMES = new Set(['postgres:', 'postgresql:']);

export function toPgEnv(dsn) {
  let url;

  try {
    url = new URL(dsn);
  } catch {
    throw new Error('not a URL');
  }

  if (!SUPPORTED_SCHEMES.has(url.protocol)) {
    throw new Error(`unsupported scheme: ${url.protocol || '(none)'}`);
  }
  if (!url.hostname) throw new Error('no host in DSN');
  if (!url.username) throw new Error('no user in DSN');

  const database = url.pathname.replace(/^\//, '');
  if (!database) throw new Error('no database in DSN');

  return {
    PGHOST: url.hostname,
    PGPORT: url.port || DEFAULT_PORT,
    // Percent-decoded: a generated password may legitimately contain / @ or #.
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(database),
    PGSSLMODE: url.searchParams.get('sslmode') ?? DEFAULT_SSLMODE
  };
}

export function main(env, write, fail) {
  const dsn = env.DSN ?? '';

  if (!dsn) {
    fail('DSN is empty');
    return 1;
  }

  let pgEnv;
  try {
    pgEnv = toPgEnv(dsn);
  } catch (error) {
    // The message never carries the DSN: this runs into CI logs.
    fail(`could not parse DSN: ${error.message}`);
    return 1;
  }

  for (const [key, value] of Object.entries(pgEnv)) {
    write(`${key}=${value}`);
  }

  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(
    main(
      process.env,
      (line) => process.stdout.write(`${line}\n`),
      (message) => process.stderr.write(`${message}\n`)
    )
  );
}
