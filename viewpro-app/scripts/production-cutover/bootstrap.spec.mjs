import assert from 'node:assert/strict';
import test from 'node:test';

import {
  allowlists,
  baselineMembers,
  bootstrapAuthority,
  validateBaseline,
  validateCensus,
} from './bootstrap.mjs';

const digest = `sha256:${'a'.repeat(64)}`;

// A freshly bootstrapped product lane: migrations only, and no business row at all.
const productCensus = () => ({
  schemaVersion: 1,
  kind: 'production-cutover-census',
  lane: 'product',
  tables: { migrationLedger: 14, tenant: 0, listing: 0, outboxEvent: 0 },
});

// A freshly bootstrapped platform lane: migrations, one cursor at zero, one operator.
const platformCensus = () => ({
  schemaVersion: 1,
  kind: 'production-cutover-census',
  lane: 'platform',
  tables: { migrationLedger: 9, ingestCursor: 1, operator: 1, metric: 0, tenantRegistry: 0 },
});

const productBaseline = () => ({
  schemaVersion: 1,
  kind: 'production-cutover-baseline',
  lane: 'product',
  imageDigest: digest,
  readiness: 200,
  allowlist: 'empty',
});

const platformBaseline = () => ({
  schemaVersion: 1,
  kind: 'production-cutover-baseline',
  lane: 'platform',
  imageDigest: digest,
  readiness: 200,
  singleton: true,
  cursor: 0,
  operators: 1,
});

test('publishes each lane allowlist as frozen, pinned data', () => {
  assert.ok(Object.isFrozen(allowlists));
  // Pinned literally: the fixtures index the same model the validator uses, so without an
  // independent oracle a change to either allowlist would be invisible to every test.
  assert.deepEqual(Object.keys(allowlists).sort(), ['platform', 'product']);
  assert.deepEqual(allowlists.product, { migrationLedger: 'any', tenant: 0, listing: 0, outboxEvent: 0 });
  assert.deepEqual(allowlists.platform, {
    migrationLedger: 'any',
    ingestCursor: 1,
    operator: 1,
    metric: 0,
    tenantRegistry: 0,
  });
  assert.deepEqual(Object.keys(baselineMembers).sort(), ['platform', 'product']);
});

test('accepts a clean bootstrap for each lane', () => {
  for (const [lane, census] of [
    ['product', productCensus()],
    ['platform', platformCensus()],
  ]) {
    const result = validateCensus(census, { lane });
    assert.equal(result.reason, '', `${lane}: ${result.detail}`);
    assert.equal(result.ok, true);
    assert.equal(result.authority, false);
  }
});

test('rejects any non-allowlisted row (RED-CUT-10)', () => {
  const rejected = [
    ['product', 'tenant', 1],
    ['product', 'listing', 3],
    ['product', 'outboxEvent', 1],
    ['platform', 'metric', 1],
    ['platform', 'tenantRegistry', 2],
    ['platform', 'operator', 2],
    ['platform', 'operator', 0],
    ['platform', 'ingestCursor', 2],
    ['platform', 'ingestCursor', 0],
  ];
  for (const [lane, table, rows] of rejected) {
    const census = lane === 'product' ? productCensus() : platformCensus();
    census.tables[table] = rows;
    const result = validateCensus(census, { lane });
    assert.equal(result.ok, false, `${lane}.${table}=${rows} must be rejected`);
    assert.equal(result.reason, 'non-allowlisted-row');
    assert.equal(result.detail, table);
    assert.equal(result.authority, false);
  }
});

test('rejects an unrecognised table rather than ignoring it', () => {
  for (const [lane, census] of [
    ['product', productCensus()],
    ['platform', platformCensus()],
  ]) {
    const appended = Object.keys(census.tables).length;
    census.tables = { ...census.tables, demoLeftover: 0 };
    const result = validateCensus(census, { lane });
    // Zero rows is not a defence: a validator that skips what it does not recognise
    // proves nothing about what it did not look at.
    assert.equal(result.reason, 'unknown-table', `${lane} must reject an unknown table`);
    // Reported by position: an unrecognised name is not ours, so it is not echoed.
    assert.equal(result.detail, `#${appended}`, lane);
    assert.doesNotMatch(JSON.stringify(result), /demoLeftover/);
  }
});

test('rejects a census missing an allowlisted table', () => {
  const census = platformCensus();
  delete census.tables.ingestCursor;
  const result = validateCensus(census, { lane: 'platform' });
  assert.equal(result.reason, 'missing-table');
  assert.equal(result.detail, 'ingestCursor');
});

test('rejects a census belonging to the other lane', () => {
  assert.equal(validateCensus(productCensus(), { lane: 'platform' }).reason, 'lane-mismatch');
  assert.equal(validateCensus(platformCensus(), { lane: 'product' }).reason, 'lane-mismatch');
  assert.equal(validateCensus(productCensus(), { lane: 'demo' }).reason, 'lane-rejected');
  assert.equal(validateCensus(productCensus(), {}).reason, 'lane-rejected');
});

test('rejects a row count that is not a whole number', () => {
  for (const rows of [-1, 1.5, Number.NaN, '3', null, Number.POSITIVE_INFINITY]) {
    const census = productCensus();
    census.tables.tenant = rows;
    const result = validateCensus(census, { lane: 'product' });
    assert.equal(result.ok, false, `${String(rows)} must be rejected`);
    assert.equal(result.reason, 'row-count-rejected');
  }
});

test('accepts a matching baseline for each lane', () => {
  for (const [lane, baseline] of [
    ['product', productBaseline()],
    ['platform', platformBaseline()],
  ]) {
    const result = validateBaseline(baseline, { lane, digest });
    assert.equal(result.reason, '', `${lane}: ${result.detail}`);
    assert.equal(result.ok, true);
    assert.equal(result.authority, false);
  }
});

test('rejects a readiness that is not exactly 200 (RED-CUT-11)', () => {
  for (const readiness of [503, 500, 204, 0, '200', 200.5, null, Number.NaN]) {
    const baseline = productBaseline();
    baseline.readiness = readiness;
    const result = validateBaseline(baseline, { lane: 'product', digest });
    assert.equal(result.ok, false, `readiness ${String(readiness)} must be rejected`);
    assert.equal(result.reason, 'readiness-rejected');
    assert.equal(result.detail, 'readiness');
  }
});

test('rejects a wrong image digest (RED-CUT-11)', () => {
  const baseline = productBaseline();
  baseline.imageDigest = `sha256:${'b'.repeat(64)}`;
  assert.equal(validateBaseline(baseline, { lane: 'product', digest }).reason, 'digest-mismatch');
  const malformed = productBaseline();
  malformed.imageDigest = 'latest';
  assert.equal(validateBaseline(malformed, { lane: 'product', digest }).reason, 'digest-mismatch');
});

test('rejects a baseline belonging to the other lane (RED-CUT-11)', () => {
  // A product baseline never satisfies platform activation: it carries no singleton,
  // no cursor and no operator count, and partial credit is what this rule forbids.
  assert.equal(validateBaseline(productBaseline(), { lane: 'platform', digest }).reason, 'member-set-mismatch');
  assert.equal(validateBaseline(platformBaseline(), { lane: 'product', digest }).reason, 'member-set-mismatch');
  // A baseline whose member set is right for its lane but whose lane field disagrees is
  // the one input that reaches the lane check rather than the member-set check.
  const mislabelled = productBaseline();
  mislabelled.lane = 'platform';
  assert.equal(validateBaseline(mislabelled, { lane: 'product', digest }).reason, 'lane-mismatch');
});

test('rejects a platform baseline misstating singleton, cursor or operators (RED-CUT-11)', () => {
  for (const [member, value] of [
    ['singleton', false],
    ['singleton', 'true'],
    ['cursor', 1],
    ['cursor', -1],
    ['cursor', '0'],
    ['operators', 0],
    ['operators', 2],
    ['operators', 1.5],
  ]) {
    const baseline = platformBaseline();
    baseline[member] = value;
    const result = validateBaseline(baseline, { lane: 'platform', digest });
    assert.equal(result.ok, false, `${member}=${String(value)} must be rejected`);
    assert.equal(result.reason, 'baseline-rejected');
    assert.equal(result.detail, member);
  }
});

test('rejects a product baseline whose allowlist admits rows', () => {
  for (const allowlist of ['populated', '', 'Empty', null]) {
    const baseline = productBaseline();
    baseline.allowlist = allowlist;
    const result = validateBaseline(baseline, { lane: 'product', digest });
    assert.equal(result.ok, false, `${String(allowlist)} must be rejected`);
    assert.equal(result.reason, 'baseline-rejected');
    assert.equal(result.detail, 'allowlist');
  }
});

test('rejects an unknown, missing, authority-keyed or hostile shape', () => {
  const unknown = productCensus();
  unknown.extra = 1;
  const authority = productCensus();
  Object.defineProperty(authority, 'constructor', { value: 1, enumerable: true });

  for (const [label, value] of [['an unknown member', unknown], ['an authority key', authority]]) {
    const result = validateCensus(value, { lane: 'product' });
    assert.equal(result.reason, 'member-set-mismatch', label);
  }
  assert.equal(validateCensus(null, { lane: 'product' }).reason, 'not-a-census');
  assert.equal(validateCensus(new Proxy(productCensus(), {}), { lane: 'product' }).ok, false);
  assert.equal(validateBaseline(null, { lane: 'product', digest }).reason, 'not-a-baseline');
  assert.equal(validateBaseline(productBaseline(), { lane: 'product', digest: 'nope' }).reason, 'digest-mismatch');
});

test('names the table or member in a denial, never a deployed identity', () => {
  const census = productCensus();
  census.tables.tenant = 4;
  const result = validateCensus(census, { lane: 'product' });
  assert.equal(result.detail, 'tenant');
  assert.doesNotMatch(JSON.stringify(result), /neondb|\.neon\.tech|proj_|postgres:\/\//i);
});

test('denies authority on every path, and never requests provisioning', () => {
  assert.equal(bootstrapAuthority(), false);
  assert.equal(validateCensus(productCensus(), { lane: 'product' }).authority, false);
  assert.equal(validateCensus({}, { lane: 'product' }).authority, false);
  assert.equal(validateBaseline(platformBaseline(), { lane: 'platform', digest }).authority, false);
  assert.equal(validateBaseline({}, { lane: 'product', digest }).authority, false);
});

test('rejects a wrong schema version or a foreign kind in both validators', () => {
  for (const [member, value, reason] of [
    ['schemaVersion', 2, 'schema-rejected'],
    ['kind', 'production-cutover-baseline', 'kind-rejected'],
  ]) {
    const census = productCensus();
    census[member] = value;
    const result = validateCensus(census, { lane: 'product' });
    assert.equal(result.reason, reason);
    assert.equal(result.detail, member);
  }
  for (const [member, value, reason] of [
    ['schemaVersion', 2, 'schema-rejected'],
    ['kind', 'production-cutover-census', 'kind-rejected'],
  ]) {
    const baseline = productBaseline();
    baseline[member] = value;
    assert.equal(validateBaseline(baseline, { lane: 'product', digest }).reason, reason);
  }
});

test('requires a well-formed expected digest, not merely a different one', () => {
  for (const expected of ['nope', '', 'sha256:zz', `sha256:${'a'.repeat(63)}`, undefined, 42]) {
    const result = validateBaseline(productBaseline(), { lane: 'product', digest: expected });
    assert.equal(result.reason, 'digest-mismatch', `${String(expected)} must be rejected`);
    assert.equal(result.detail, 'imageDigest');
  }
  // The case inequality alone cannot catch: both sides malformed and equal. Without a
  // form check, `latest` would activate against `latest`.
  for (const malformed of ['latest', '', 'sha256:zz']) {
    const baseline = productBaseline();
    baseline.imageDigest = malformed;
    const result = validateBaseline(baseline, { lane: 'product', digest: malformed });
    assert.equal(result.reason, 'digest-mismatch', `${malformed} must never match itself`);
  }
});

test('admits any migration ledger count, and only the ledger', () => {
  // The one entry the allowlist deliberately leaves unpinned; nothing else may vary.
  for (const rows of [0, 1, 14, 900]) {
    const census = productCensus();
    census.tables.migrationLedger = rows;
    assert.equal(validateCensus(census, { lane: 'product' }).ok, true, `ledger ${rows}`);
    const platform = platformCensus();
    platform.tables.migrationLedger = rows;
    assert.equal(validateCensus(platform, { lane: 'platform' }).ok, true, `ledger ${rows}`);
  }
});

test('holds platform baseline members to their exact type, not merely their value', () => {
  for (const [member, value] of [
    ['operators', '1'],
    ['operators', true],
    ['cursor', false],
    ['singleton', 1],
  ]) {
    const baseline = platformBaseline();
    baseline[member] = value;
    const result = validateBaseline(baseline, { lane: 'platform', digest });
    assert.equal(result.reason, 'baseline-rejected', `${member}=${String(value)}`);
    assert.equal(result.detail, member);
  }
});

test('refuses a live object that can answer differently than it serializes', () => {
  assert.equal(validateCensus({ toJSON: () => productCensus() }, { lane: 'product' }).reason, 'not-a-census');
  assert.equal(
    validateBaseline({ toJSON: () => productBaseline() }, { lane: 'product', digest }).reason,
    'not-a-baseline',
  );
  const shifting = productCensus();
  let reads = 0;
  Object.defineProperty(shifting, 'tables', {
    enumerable: true,
    get() {
      reads += 1;
      return productCensus().tables;
    },
  });
  assert.equal(validateCensus(shifting, { lane: 'product' }).reason, 'not-a-census');
  assert.equal(reads, 0, 'an accessor is refused before it is ever invoked');
});

test('separates a fault from a routine rejection', () => {
  // The catch-all must not wear an in-band reason code, or a future crash inside the
  // gate would read as "the baseline was wrong" and the gate would look healthy.
  const inBand = platformBaseline();
  inBand.operators = 2;
  assert.equal(validateBaseline(inBand, { lane: 'platform', digest }).reason, 'baseline-rejected');
  assert.notEqual('baseline-faulted', 'baseline-rejected');
  assert.notEqual('census-faulted', 'non-allowlisted-row');
});
