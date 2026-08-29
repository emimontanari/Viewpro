import assert from 'node:assert/strict';
import test from 'node:test';

import {
  knownGrants,
  lanePrincipals,
  lanes,
  migrationObjects,
  permittedGrants,
  requiredGrants,
  rolesAuthority,
  validateCatalog,
} from './roles.mjs';

const lane = 'product';
const asOf = '2026-08-26T00:00:00.000Z';
const approved = { approvedBy: 'maintainer', expiresAt: '2026-12-31T00:00:00.000Z' };

// A catalog snapshot for one lane, exactly matching the least-privilege model.
const catalog = () => ({
  schemaVersion: 1,
  kind: 'production-cutover-role-catalog',
  lane,
  grants: {
    public: [],
    migrator: ['db:connect', 'schema:usage', 'schema:create', 'db:create', 'db:temp'],
    runtime: ['db:connect', 'schema:usage', 'table:dml', 'sequence:use'],
    backup: ['db:connect', 'schema:usage', 'table:read', 'sequence:read'],
  },
  owners: { migrator: ['migration'] },
  memberships: {},
  exceptions: [],
});

const judge = (value, options = {}) => validateCatalog(value, { lane, asOf, ...options });

test('pins the lane model as frozen literals, independent of the module', () => {
  for (const frozen of [lanePrincipals, lanes, knownGrants, requiredGrants, permittedGrants, migrationObjects]) {
    assert.ok(Object.isFrozen(frozen));
  }
  assert.deepEqual([...lanePrincipals], ['public', 'migrator', 'runtime', 'backup']);
  assert.deepEqual([...lanes], ['product', 'platform']);
  assert.deepEqual([...migrationObjects], ['migration', 'migrationLedger']);
  assert.deepEqual([...requiredGrants.public], []);
  assert.deepEqual([...requiredGrants.migrator], ['db:connect', 'schema:usage', 'schema:create']);
  assert.deepEqual([...requiredGrants.runtime], ['db:connect', 'schema:usage', 'table:dml', 'sequence:use']);
  assert.deepEqual([...requiredGrants.backup], ['db:connect', 'schema:usage', 'table:read', 'sequence:read']);
  // Pinned because widening this table is the failure mode the complement test measures
  // against; without an independent literal, model and oracle would move together.
  assert.deepEqual([...permittedGrants.public], []);
  assert.deepEqual([...permittedGrants.migrator], ['db:create', 'db:temp']);
  assert.deepEqual([...permittedGrants.runtime], ['table:read', 'sequence:read']);
  assert.deepEqual([...permittedGrants.backup], []);
});

test('accepts a catalog that matches the least-privilege model', () => {
  const result = judge(catalog());
  assert.equal(result.reason, '', result.detail);
  assert.equal(result.ok, true);
  assert.equal(result.authority, false);
});

test('detects every excess privilege the model denies (RED-CUT-09)', () => {
  // Derived from the complement, never hand-listed: a blacklist cannot notice the
  // allowed table widening, which is exactly the failure this gate exists to catch.
  let checked = 0;
  for (const principal of lanePrincipals) {
    const allowed = [...requiredGrants[principal], ...permittedGrants[principal]];
    for (const grant of knownGrants) {
      if (allowed.includes(grant)) continue;
      const value = catalog();
      value.grants[principal] = [...value.grants[principal], grant];
      const result = judge(value);
      assert.equal(result.ok, false, `${principal} must not hold ${grant}`);
      assert.equal(result.reason, 'excess-privilege', `${principal}:${grant}`);
      assert.equal(result.detail, `${principal}:${grant}`);
      checked += 1;
    }
  }
  assert.ok(checked >= 30, `the denied complement must be non-trivial, checked ${checked}`);
});

test('accepts every grant the model permits, so the gate is usable', () => {
  // The mirror of the complement: a gate that rejects every real lane is not a gate,
  // it is pressure to widen the model.
  for (const principal of lanePrincipals) {
    for (const grant of permittedGrants[principal]) {
      const value = catalog();
      value.grants[principal] = [...new Set([...value.grants[principal], grant])];
      assert.equal(judge(value).ok, true, `${principal} may hold ${grant}`);
    }
  }
});

test('detects excess ownership (RED-CUT-09)', () => {
  for (const principal of ['public', 'runtime', 'backup']) {
    const value = catalog();
    value.owners = { ...value.owners, [principal]: ['migration'] };
    const result = judge(value);
    assert.equal(result.ok, false, `${principal} must own nothing`);
    assert.equal(result.reason, 'excess-ownership');
    assert.equal(result.detail, `${principal}:migration`);
  }
});

test('bounds the migrator to migration objects (RED-CUT-09)', () => {
  for (const object of migrationObjects) {
    const value = catalog();
    value.owners = { migrator: [object] };
    assert.equal(judge(value).ok, true, `the migrator may own ${object}`);
  }
  // Ownership carries ALTER and DROP, so an unbounded migrator could reshape business
  // tables and disable their row-level security.
  const value = catalog();
  value.owners = { migrator: ['migration', 'tenant'] };
  const result = judge(value);
  assert.equal(result.reason, 'excess-ownership');
  assert.equal(result.ok, false);
});

test('detects excess role membership (RED-CUT-09)', () => {
  for (const [principal, member] of [
    ['runtime', 'migrator'],
    ['backup', 'migrator'],
    ['migrator', 'runtime'],
    ['public', 'backup'],
  ]) {
    const value = catalog();
    value.memberships = { [principal]: [member] };
    const result = judge(value);
    assert.equal(result.ok, false, `${principal} must not be a member of ${member}`);
    assert.equal(result.reason, 'excess-membership');
    assert.equal(result.detail, `${principal}:${member}`);
  }
  const empty = catalog();
  empty.memberships = { public: [], runtime: [], backup: [] };
  assert.equal(judge(empty).ok, true, 'an empty membership list is not a membership');
});

test('detects a missing required grant, so holding nothing is not a pass', () => {
  for (const principal of lanePrincipals) {
    for (const grant of requiredGrants[principal]) {
      const value = catalog();
      value.grants[principal] = value.grants[principal].filter((held) => held !== grant);
      const result = judge(value);
      assert.equal(result.ok, false, `${principal} must hold ${grant}`);
      assert.equal(result.reason, 'missing-grant');
      assert.equal(result.detail, `${principal}:${grant}`);
    }
  }
});

test('admits an owner exception only while genuinely approved and unexpired', () => {
  const withException = (exception, options) => {
    const value = catalog();
    value.owners = { ...value.owners, runtime: ['migration'] };
    value.exceptions = [exception];
    return validateCatalog(value, { lane, asOf, ...options });
  };
  assert.equal(withException({ principal: 'runtime', object: 'migration', ...approved }).ok, true);

  // `null`, `false` and `0` are what a serializer writes for an ABSENT approval, so a
  // guard that only rejects the empty string approves the unapproved.
  for (const approvedBy of ['', ' ', '\t', null, false, 0, [], {}, 1]) {
    const result = withException({
      principal: 'runtime',
      object: 'migration',
      approvedBy,
      expiresAt: '2026-12-31T00:00:00.000Z',
    });
    assert.equal(result.ok, false, `approvedBy=${JSON.stringify(approvedBy)} must not approve`);
    assert.equal(result.reason, 'excess-ownership');
  }

  for (const [label, exception, options] of [
    ['expired', { principal: 'runtime', object: 'migration', approvedBy: 'm', expiresAt: '2026-01-01T00:00:00.000Z' }, {}],
    ['expiring exactly now', { principal: 'runtime', object: 'migration', approvedBy: 'm', expiresAt: asOf }, {}],
    ['for another principal', { principal: 'backup', object: 'migration', ...approved }, {}],
    ['for another object', { principal: 'runtime', object: 'audit', ...approved }, {}],
    ['shaped but impossible', { principal: 'runtime', object: 'migration', approvedBy: 'm', expiresAt: '9999-99-99T99:99:99.999Z' }, {}],
    ['impossible day', { principal: 'runtime', object: 'migration', approvedBy: 'm', expiresAt: '2026-02-31T00:00:00.000Z' }, {}],
  ]) {
    const result = withException(exception, options);
    assert.equal(result.ok, false, `an ${label} exception must not admit ownership`);
    assert.equal(result.reason, 'excess-ownership');
  }
});

test('refuses an exception that would licence a privilege or membership', () => {
  const value = catalog();
  value.grants.runtime = [...value.grants.runtime, 'schema:create'];
  value.exceptions = [{ principal: 'runtime', object: 'migration', ...approved }];
  // Exceptions cover default ownership only. A privilege is chosen, never inherited.
  assert.equal(judge(value).reason, 'excess-privilege');
});

test('rejects a malformed exception rather than ignoring it alongside valid ones', () => {
  for (const exception of [
    { principal: 'runtime', object: 'migration', approvedBy: 'm' },
    { principal: 'nobody', object: 'migration', ...approved },
    { principal: 'runtime', object: 7, ...approved },
    'not-a-record',
  ]) {
    const value = catalog();
    value.exceptions = [exception];
    assert.equal(judge(value).ok, false, `${JSON.stringify(exception)} must be rejected`);
  }
});

test('binds the catalog to the lane the caller expects', () => {
  const platform = catalog();
  platform.lane = 'platform';
  assert.equal(judge(platform).reason, 'lane-mismatch');
  assert.equal(validateCatalog(catalog(), { lane: 'platform', asOf }).reason, 'lane-mismatch');
  assert.equal(validateCatalog(catalog(), { lane: 'demo', asOf }).reason, 'lane-rejected');
  assert.equal(validateCatalog(catalog(), { asOf }).reason, 'lane-rejected');
});

test('rejects a wrong schema version or a foreign kind', () => {
  for (const [member, value, reason] of [
    ['schemaVersion', 2, 'schema-rejected'],
    ['kind', 'production-cutover-census', 'kind-rejected'],
  ]) {
    const candidate = catalog();
    candidate[member] = value;
    const result = judge(candidate);
    assert.equal(result.reason, reason);
    assert.equal(result.detail, member);
  }
});

test('rejects an unknown principal, grant or shape', () => {
  const unknownPrincipal = catalog();
  unknownPrincipal.grants.admin = ['db:connect'];
  const unknownOwner = catalog();
  unknownOwner.owners = { admin: ['migration'] };
  const unknownGrant = catalog();
  unknownGrant.grants.runtime = [...unknownGrant.grants.runtime, 'db:vacuum'];
  const missingMember = catalog();
  delete missingMember.memberships;
  const extraMember = catalog();
  extraMember.extra = 1;
  const authority = catalog();
  Object.defineProperty(authority, 'constructor', { value: 1, enumerable: true });
  const badOwners = catalog();
  badOwners.owners = 'nope';
  const badMemberships = catalog();
  badMemberships.memberships = 'nope';

  for (const [label, value, reason, detail] of [
    ['an unknown principal in grants', unknownPrincipal, 'unknown-principal', 'grants'],
    ['an unknown principal in owners', unknownOwner, 'unknown-principal', 'owners:#0'],
    ['an unknown grant', unknownGrant, 'unknown-grant', 'runtime:#4'],
    ['a missing member', missingMember, 'member-set-mismatch', ''],
    ['an unknown member', extraMember, 'member-set-mismatch', ''],
    ['an authority key', authority, 'member-set-mismatch', ''],
    ['a non-object owners', badOwners, 'member-set-mismatch', 'owners'],
    ['a non-object memberships', badMemberships, 'member-set-mismatch', 'memberships'],
  ]) {
    const result = judge(value);
    assert.equal(result.reason, reason, label);
    assert.equal(result.detail, detail, label);
  }
  assert.equal(judge(null).reason, 'not-a-catalog');
  assert.equal(judge(new Proxy(catalog(), {})).ok, false);
});

test('refuses a live object that can answer differently than it serializes', () => {
  // A getter was already refused; `toJSON` is strictly more powerful and replaces the
  // whole value, so a one-member object could otherwise pass as an entire catalog.
  assert.equal(validateCatalog({ toJSON: () => catalog() }, { lane, asOf }).reason, 'not-a-catalog');

  const shifting = catalog();
  let reads = 0;
  Object.defineProperty(shifting, 'grants', {
    enumerable: true,
    get() {
      reads += 1;
      return catalog().grants;
    },
  });
  assert.equal(judge(shifting).reason, 'not-a-catalog');
  assert.equal(reads, 0, 'an accessor is refused before it is ever invoked');

  const nested = catalog();
  nested.grants = new Proxy(nested.grants, {});
  assert.equal(judge(nested).reason, 'not-a-catalog');
});

test('names a closed-vocabulary token or a position, never a deployed identity', () => {
  const hostile = [
    ['memberships', { runtime: ['neon_superuser'] }],
    ['owners', { runtime: ['postgres://user:pw@db.internal:5432/app'] }],
  ];
  for (const [member, value] of hostile) {
    const candidate = catalog();
    candidate[member] = value;
    const result = judge(candidate);
    assert.equal(result.ok, false);
    // Every one of these strings is a real deployed identity shape.
    assert.doesNotMatch(
      JSON.stringify(result),
      /neon_superuser|neondb|postgres:\/\/|db\.internal|proj_/i,
      `${member} must not echo its value`,
    );
  }
  const unknownOwner = catalog();
  unknownOwner.owners = { admin: ['migration'] };
  assert.doesNotMatch(JSON.stringify(judge(unknownOwner)), /admin/);
});

test('requires a real observation instant rather than a well-shaped one', () => {
  for (const value of [undefined, '', 'today', 0, '9999-99-99T99:99:99.999Z', '2026-02-31T00:00:00.000Z']) {
    const result = validateCatalog(catalog(), { lane, asOf: value });
    assert.equal(result.reason, 'as-of-rejected', `asOf=${String(value)} must be rejected`);
    assert.equal(result.detail, 'asOf');
  }
});

test('denies authority on every path', () => {
  assert.equal(rolesAuthority(), false);
  assert.equal(judge(catalog()).authority, false);
  assert.equal(judge({}).authority, false);
  assert.equal(judge(null).authority, false);
});
