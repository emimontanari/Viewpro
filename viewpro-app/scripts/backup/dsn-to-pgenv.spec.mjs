import assert from 'node:assert/strict';
import test from 'node:test';

import { main, toPgEnv } from './dsn-to-pgenv.mjs';

const NEON =
  'postgresql://neondb_owner:secret@ep-jolly.us-east-1.aws.neon.tech/neondb?sslmode=require';

const run = (env) => {
  const lines = [];
  const errors = [];
  const code = main(env, (line) => lines.push(line), (message) => errors.push(message));
  return { code, lines, errors };
};

test('splits a Neon DSN into the variables libpq reads', () => {
  assert.deepEqual(toPgEnv(NEON), {
    PGHOST: 'ep-jolly.us-east-1.aws.neon.tech',
    PGPORT: '5432',
    PGUSER: 'neondb_owner',
    PGPASSWORD: 'secret',
    PGDATABASE: 'neondb',
    PGSSLMODE: 'require'
  });
});

test('percent-decodes a password that carries URL-significant characters', () => {
  // A generated password may legitimately contain / @ or #, which is exactly
  // what a naive split on those characters would corrupt.
  const dsn = 'postgresql://u:np_A%2Fb%40c%23d@host.test/db';

  assert.equal(toPgEnv(dsn).PGPASSWORD, 'np_A/b@c#d');
});

test('keeps an explicit port and an explicit sslmode', () => {
  const parsed = toPgEnv('postgresql://u:p@host.test:6543/db?sslmode=verify-full');

  assert.equal(parsed.PGPORT, '6543');
  assert.equal(parsed.PGSSLMODE, 'verify-full');
});

test('defaults sslmode to require rather than leaving it unset', () => {
  // An unset sslmode lets libpq fall back to a plaintext connection. For a
  // production database reached over the public internet that is not a default
  // worth inheriting.
  assert.equal(toPgEnv('postgresql://u:p@host.test/db').PGSSLMODE, 'require');
});

test('accepts both postgres:// and postgresql://', () => {
  assert.equal(toPgEnv('postgres://u:p@host.test/db').PGHOST, 'host.test');
});

// Each case asserts WHY it was refused, not merely that it was. Asserting only
// `throws()` let the guards cover for each other: removing the host check still
// passed, because the user check tripped on the same input.
for (const [label, dsn, reason] of [
  // No DSN has a user but no host — Node's URL rejects that shape outright —
  // so this input trips the host check only because it runs first. Asserting
  // the reason is what makes that ordering a pinned decision instead of an
  // accident.
  ['a DSN with no host', 'postgresql:///db', /no host/],
  ['a DSN with no user', 'postgresql://host.test/db', /no user/],
  ['a DSN with no database', 'postgresql://u:p@host.test', /no database/],
  ['another scheme entirely', 'mysql://u:p@host.test/db', /unsupported scheme/],
  ['something that is not a URL at all', 'just-a-string', /not a URL/]
]) {
  test(`refuses ${label} for that reason, not another`, () => {
    assert.throws(() => toPgEnv(dsn), reason);
  });
}

test('emits nothing and fails when the DSN is missing', () => {
  const { code, lines, errors } = run({});

  assert.equal(code, 1);
  assert.deepEqual(lines, []);
  assert.equal(errors.length, 1);
});

test('emits nothing at all when the DSN cannot be parsed', () => {
  // Partial output is the dangerous shape: a caller that ignored the exit
  // status would dump against a half-configured connection.
  const { code, lines } = run({ DSN: 'postgresql://host.test/db' });

  assert.equal(code, 1);
  assert.deepEqual(lines, []);
});

test('never puts the DSN or the password in an error message', () => {
  // These messages go into CI logs, where GitHub masks the secret value but not
  // anything derived from it.
  const { errors } = run({ DSN: 'postgresql://u:hunter2@host.test' });

  assert.equal(errors.length, 1);
  assert.ok(!errors[0].includes('hunter2'));
  assert.ok(!errors[0].includes('host.test'));
});

test('writes one KEY=value line per variable, in a shape a shell can read', () => {
  const { code, lines } = run({ DSN: NEON });

  assert.equal(code, 0);
  assert.equal(lines.length, 6);
  for (const line of lines) {
    assert.match(line, /^PG[A-Z]+=.+$/);
  }
});
