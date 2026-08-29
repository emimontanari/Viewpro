import assert from 'node:assert/strict';
import test from 'node:test';

import {
  backupLineageAuthority,
  backupLanes,
  collides,
  retainedUntil,
  validateLineageSet,
  validatePrune,
} from './backup-lineage.mjs';

const opened = '2026-07-27T06:00:00.000Z';

const lineage = (overrides = {}) => ({
  schemaVersion: 1,
  kind: 'production-cutover-backup-lineage',
  lane: 'product',
  generation: 2,
  prefix: 'inmoview-prod-gen2',
  retentionOpenedAt: opened,
  ...overrides,
});

const set = (...entries) => ({
  schemaVersion: 1,
  kind: 'production-cutover-backup-lineage-set',
  lineages: entries.length > 0 ? entries : [lineage()],
});

const prune = (overrides = {}) => ({
  schemaVersion: 1,
  kind: 'production-cutover-prune-plan',
  prefix: 'inmoview-prod-gen1',
  objects: ['inmoview-prod-gen1/inmoview-prod-2026-06-01T06-00-00Z.sql.gz'],
  ...overrides,
});

const retained = lineage({ generation: 1, prefix: 'inmoview-prod-gen1' });

test('pins the lanes and the retention rule as frozen data', () => {
  assert.ok(Object.isFrozen(backupLanes));
  assert.deepEqual([...backupLanes], ['product', 'platform']);
  // One calendar month, not thirty days: the two differ for most months of the year.
  const until = (opened) => new Date(retainedUntil(opened)).toISOString();
  assert.equal(until('2026-07-27T06:00:00.000Z'), '2026-08-27T06:00:00.000Z');
  assert.equal(until('2026-12-15T00:00:00.000Z'), '2027-01-15T00:00:00.000Z');
  // A day the next month does not have OVERFLOWS rather than clamping: clamping 31
  // January to 28 February would be a twenty-eight day window, shorter than the thirty
  // day rule this replaces. A retention floor must round up.
  assert.equal(until('2026-01-31T00:00:00.000Z'), '2026-03-03T00:00:00.000Z');
  assert.equal(until('2028-01-31T00:00:00.000Z'), '2028-03-02T00:00:00.000Z');
  for (const opened of ['2026-01-29', '2026-01-30', '2026-01-31']) {
    const window = (retainedUntil(`${opened}T00:00:00.000Z`) - Date.parse(`${opened}T00:00:00.000Z`)) / 86400000;
    assert.ok(window >= 30, `${opened} must retain at least thirty days, got ${window}`);
  }
  // Unusable input is NaN, never a sentinel that could compare as "not retained".
  assert.ok(Number.isNaN(retainedUntil('not-an-instant')));

  // Anchored to UTC, not to the host's local day. A local-time implementation agrees
  // with this one under UTC and eastward offsets, so the fixtures straddle a UTC date
  // edge in both directions to make the difference observable wherever CI runs.
  assert.equal(until('2026-01-31T23:30:00.000Z'), '2026-03-03T23:30:00.000Z');
  assert.equal(until('2026-02-01T00:30:00.000Z'), '2026-03-01T00:30:00.000Z');
});

test('accepts a well-formed set of distinct lineages', () => {
  const result = validateLineageSet(set(retained, lineage()));
  assert.equal(result.reason, '', result.detail);
  assert.equal(result.ok, true);
  assert.equal(result.authority, false);
  // Pinned: a success must carry nothing beyond the envelope, or an internal field
  // holding deployed prefixes could reach a public result.
  assert.deepEqual(Object.keys(result), ['ok', 'authority', 'reason', 'detail']);
  assert.equal(result.detail, '');
  // A three-segment prefix is accepted; the grammar is not limited to two.
  assert.equal(validateLineageSet(set(lineage({ prefix: 'a/b/c' }))).ok, true);
});

test('judges collision on whole path segments (RED-CUT-08)', () => {
  // Containment matters because listing a prefix enumerates everything beneath it.
  for (const [left, right, colliding] of [
    ['alpha', 'alpha', true],
    ['alpha', 'alpha/beta', true],
    ['alpha/beta', 'alpha', true],
    ['alpha/beta', 'alpha/beta/gamma', true],
    // A store lists by byte prefix, so a leading-string overlap is a real sweep even
    // with no shared path segment. `<name>` vs `<name>-<generation>` is precisely the
    // pair the rule exists for.
    ['alpha', 'alphabet', true],
    ['alpha', 'alpha-gen2', true],
    ['inmoview-prod', 'inmoview-prod-gen2', true],
    ['alpha/beta', 'alpha/betamax', true],
    ['alpha', 'beta', false],
    ['x/alpha/beta', 'alpha', false],
    ['alphabet', 'beta', false],
  ]) {
    assert.equal(collides(left, right), colliding, `${left} vs ${right}`);
    assert.equal(collides(right, left), colliding, `${right} vs ${left} must be symmetric`);
  }
  // A predicate that cannot tell must answer "colliding", never "distinct".
  for (const [left, right] of [[null, 'alpha'], [undefined, undefined], [7, 7], ['alpha', {}]]) {
    assert.equal(collides(left, right), true, `${String(left)} vs ${String(right)}`);
  }
});

test('rejects a lineage set whose prefixes collide (RED-CUT-08)', () => {
  for (const [label, prefix] of [
    ['an identical prefix', 'inmoview-prod-gen1'],
    ['a contained prefix', 'inmoview-prod-gen1/nightly'],
    ['a containing prefix', 'inmoview-prod-gen1'],
  ]) {
    const result = validateLineageSet(set(retained, lineage({ prefix })));
    assert.equal(result.ok, false, label);
    assert.equal(result.reason, 'prefix-collision');
    assert.equal(result.authority, false);
  }
  // A fresh generation reusing the retained generation's own prefix is the case the
  // whole rule exists for: two generations interleaved under one address.
  const reused = validateLineageSet(set(retained, lineage({ prefix: retained.prefix })));
  assert.equal(reused.reason, 'prefix-collision');
});

test('rejects prefixes that share a leading string, and accepts genuinely distinct ones', () => {
  const overlapping = validateLineageSet(
    set(lineage({ generation: 1, prefix: 'inmoview-prod' }), lineage({ prefix: 'inmoview-production' })),
  );
  assert.equal(overlapping.reason, 'prefix-collision');
  // Generations belong in their own segment, which is how a real set stays distinct.
  const distinct = validateLineageSet(
    set(lineage({ generation: 1, prefix: 'inmoview/gen1' }), lineage({ prefix: 'inmoview/gen2' })),
  );
  assert.equal(distinct.ok, true, distinct.detail);
});

test('accepts one generation per lane, and rejects two of the same', () => {
  // The central legal configuration: the same generation number in both lanes.
  const perLane = validateLineageSet(
    set(lineage({ lane: 'product', prefix: 'product/gen2' }), lineage({ lane: 'platform', prefix: 'platform/gen2' })),
  );
  assert.equal(perLane.ok, true, perLane.detail);
  const twice = validateLineageSet(
    set(lineage({ lane: 'platform', prefix: 'platform/gen2' }), lineage({ lane: 'platform', prefix: 'platform/gen2b' })),
  );
  assert.equal(twice.reason, 'duplicate-generation');
});

test('validates the whole prune-plan envelope', () => {
  const lineages = set(retained);
  const asOf = '2027-01-01T00:00:00.000Z';
  for (const [label, overrides, reason, detail] of [
    ['a wrong schema version', { schemaVersion: 2 }, 'schema-rejected', 'schemaVersion'],
    ['a foreign kind', { kind: 'production-cutover-backup-lineage' }, 'kind-rejected', 'kind'],
    ['a malformed prefix', { prefix: 'in*valid' }, 'prefix-rejected', 'prefix'],
    ['a non-array objects', { objects: 'not-an-array' }, 'member-set-mismatch', 'objects'],
  ]) {
    const result = validatePrune(prune(overrides), { lineages, asOf });
    assert.equal(result.reason, reason, label);
    assert.equal(result.detail, detail, label);
  }
  const extra = prune();
  extra.note = 'unexpected';
  assert.equal(validatePrune(extra, { lineages, asOf }).reason, 'member-set-mismatch');
  const missing = prune();
  delete missing.prefix;
  assert.equal(validatePrune(missing, { lineages, asOf }).reason, 'member-set-mismatch');
});

test('validates the whole lineage-set and lineage envelope', () => {
  for (const [label, mutate, reason] of [
    ['a wrong set schema version', (v) => { v.schemaVersion = 2; }, 'schema-rejected'],
    ['a foreign set kind', (v) => { v.kind = 'production-cutover-prune-plan'; }, 'kind-rejected'],
    ['a non-array lineages', (v) => { v.lineages = 'nope'; }, 'member-set-mismatch'],
    ['a wrong entry schema version', (v) => { v.lineages[0].schemaVersion = 2; }, 'schema-rejected'],
    ['a foreign entry kind', (v) => { v.lineages[0].kind = 'other'; }, 'kind-rejected'],
    ['a missing entry member', (v) => { delete v.lineages[0].retentionOpenedAt; }, 'member-set-mismatch'],
    ['a misspelled entry member', (v) => { v.lineages[0].prefixx = v.lineages[0].prefix; delete v.lineages[0].prefix; }, 'member-set-mismatch'],
  ]) {
    const value = set();
    mutate(value);
    assert.equal(validateLineageSet(value).reason, reason, label);
  }
});

test('rejects a prune authorised against a parent lineage', () => {
  // Ownership is identity, never containment: a descendant prefix would otherwise be
  // pruned against its parent's retention clock.
  const result = validatePrune(
    prune({ prefix: 'inmoview-prod-gen1/nightly', objects: ['inmoview-prod-gen1/nightly/x.sql.gz'] }),
    { lineages: set(retained), asOf: '2027-01-01T00:00:00.000Z' },
  );
  assert.equal(result.reason, 'unknown-lineage');
});

test('refuses a hostile value nested inside the lineage list', () => {
  const asOf = '2027-01-01T00:00:00.000Z';
  for (const [label, lineages] of [
    ['a proxied array', { ...set(), lineages: new Proxy([lineage()], {}) }],
    ['a class instance', { ...set(), lineages: [Object.assign(Object.create({ inherited: 1 }), lineage())] }],
    ['an array subclass', { ...set(), lineages: Object.setPrototypeOf([lineage()], class extends Array {}.prototype) }],
    ['a symbol-keyed member', { ...set(), lineages: [Object.assign(lineage(), { [Symbol('s')]: 1 })] }],
    ['excessive nesting', { ...set(), lineages: [{ ...lineage(), prefix: Array.from({ length: 12 }).reduce((deep) => ({ deep }), {}) }] }],
  ]) {
    // The reason, not merely the refusal: without the depth cap the value walks through
    // and is refused later by the key grammar, which proves something else entirely.
    assert.equal(validateLineageSet(lineages).reason, 'not-a-lineage-set', label);
    assert.equal(validatePrune(prune(), { lineages, asOf }).ok, false, label);
  }
});

test('names a position, not the lineage prefix, when a retained prune is refused', () => {
  // The retained-prune denial is the one path that has a deployed prefix in hand.
  const hostile = lineage({
    generation: 1,
    prefix: 'ep-cool-darkness.aws.neon.tech.proj_a1b2c3',
    retentionOpenedAt: '2026-08-20T00:00:00.000Z',
  });
  const result = validatePrune(
    prune({ prefix: hostile.prefix, objects: [`${hostile.prefix}/dump.sql.gz`] }),
    { lineages: set(hostile), asOf: '2026-08-25T00:00:00.000Z' },
  );
  assert.equal(result.reason, 'retained-lineage-prune');
  assert.equal(result.detail, 'lineages:#0');
  assert.doesNotMatch(JSON.stringify(result), /neon\.tech|proj_a1b2c3|ep-cool/i);
});

test('rejects a duplicate lane and generation pair', () => {
  const result = validateLineageSet(set(retained, lineage({ generation: 1, prefix: 'other-prefix' })));
  assert.equal(result.reason, 'duplicate-generation');
  assert.equal(result.ok, false);
});

test('rejects a malformed prefix, lane, generation or instant', () => {
  for (const [label, overrides, reason] of [
    ['an empty prefix', { prefix: '' }, 'prefix-rejected'],
    ['a leading slash', { prefix: '/inmoview' }, 'prefix-rejected'],
    ['a trailing slash', { prefix: 'inmoview/' }, 'prefix-rejected'],
    ['a doubled slash', { prefix: 'inmoview//prod' }, 'prefix-rejected'],
    ['a relative segment', { prefix: 'inmoview/../prod' }, 'prefix-rejected'],
    ['a wildcard', { prefix: 'inmoview-*' }, 'prefix-rejected'],
    ['a non-string prefix', { prefix: 7 }, 'prefix-rejected'],
    ['an unknown lane', { lane: 'demo' }, 'lane-rejected'],
    ['a zero generation', { generation: 0 }, 'generation-rejected'],
    ['a fractional generation', { generation: 1.5 }, 'generation-rejected'],
    ['a shaped but impossible instant', { retentionOpenedAt: '2026-02-31T00:00:00.000Z' }, 'retention-opened-rejected'],
    // A month 13 or hour 25 fails to parse at all, a different branch from 31 February,
    // which parses into the following month and is caught by the round trip.
    ['an impossible month', { retentionOpenedAt: '2026-13-01T00:00:00.000Z' }, 'retention-opened-rejected'],
    ['an impossible hour', { retentionOpenedAt: '2026-07-27T25:00:00.000Z' }, 'retention-opened-rejected'],
    ['a free-text instant', { retentionOpenedAt: 'yesterday' }, 'retention-opened-rejected'],
    ['a leading-punctuation prefix', { prefix: '.hidden' }, 'prefix-rejected'],
    ['a leading-dash prefix', { prefix: '-flag' }, 'prefix-rejected'],
    ['an unsafe generation', { generation: 2 ** 53 }, 'generation-rejected'],
  ]) {
    const result = validateLineageSet(set(lineage(overrides)));
    assert.equal(result.ok, false, label);
    assert.equal(result.reason, reason, label);
  }
});

test('rejects a prune of a lineage still inside its calendar month (RED-CUT-08)', () => {
  const result = validatePrune(prune(), { lineages: set(retained), asOf: '2026-08-01T00:00:00.000Z' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'retained-lineage-prune');
  assert.equal(result.authority, false);
});

test('rejects a thirty-day prune of a month-long retention (RED-CUT-08)', () => {
  // July has 31 days, so thirty days after 27 July is 26 August — still retained.
  // The deployed job prunes at thirty days; the contract requires one calendar month.
  const dayThirty = '2026-08-26T06:00:00.000Z';
  assert.ok(retainedUntil(opened) > Date.parse(dayThirty), 'day thirty is inside the month');
  const result = validatePrune(prune(), { lineages: set(retained), asOf: dayThirty });
  assert.equal(result.reason, 'retained-lineage-prune');
  assert.equal(result.ok, false);
});

test('permits a prune once the calendar month has fully elapsed', () => {
  const result = validatePrune(prune(), { lineages: set(retained), asOf: '2026-08-27T06:00:00.000Z' });
  assert.equal(result.reason, '', result.detail);
  assert.equal(result.ok, true);
  // Permitting is not doing: the validator removes nothing and grants nothing.
  assert.equal(result.authority, false);
});

test('rejects a prune reaching outside its own lineage', () => {
  for (const [label, objects, reason] of [
    ['another lineage', ['inmoview-prod-gen2/nightly.sql.gz'], 'object-outside-lineage'],
    ['a sibling by string only', ['inmoview-prod-gen10/nightly.sql.gz'], 'object-outside-lineage'],
    ['the bucket root', ['nightly.sql.gz'], 'object-outside-lineage'],
    // A traversal is a malformed key, so the key grammar refuses it before containment
    // is ever consulted. Both rules fail closed; naming which one fired keeps the
    // denial honest about what was actually checked.
    ['a traversal', ['inmoview-prod-gen1/../inmoview-prod-gen2/x.sql.gz'], 'object-rejected'],
    ['a wildcard', ['inmoview-prod-gen1/*'], 'object-rejected'],
  ]) {
    const result = validatePrune(prune({ objects }), {
      lineages: set(retained, lineage()),
      asOf: '2027-01-01T00:00:00.000Z',
    });
    assert.equal(result.ok, false, label);
    assert.equal(result.reason, reason, label);
  }
});

test('rejects a prune whose prefix belongs to no known lineage', () => {
  const result = validatePrune(prune({ prefix: 'unknown-prefix', objects: ['unknown-prefix/x.gz'] }), {
    lineages: set(retained),
    asOf: '2027-01-01T00:00:00.000Z',
  });
  assert.equal(result.reason, 'unknown-lineage');
  assert.equal(result.ok, false);
});

test('rejects a prune with a missing, malformed or absent observation instant', () => {
  for (const asOf of [undefined, '', 'today', 0, '2026-02-31T00:00:00.000Z']) {
    const result = validatePrune(prune(), { lineages: set(retained), asOf });
    assert.equal(result.reason, 'as-of-rejected', `asOf=${String(asOf)}`);
  }
});

test('rejects an empty prune rather than permitting a no-op', () => {
  const result = validatePrune(prune({ objects: [] }), {
    lineages: set(retained),
    asOf: '2027-01-01T00:00:00.000Z',
  });
  assert.equal(result.reason, 'empty-prune');
  assert.equal(result.ok, false);
});

test('rejects an unknown, missing, authority-keyed or hostile shape', () => {
  const unknown = set();
  unknown.extra = 1;
  const authority = set();
  Object.defineProperty(authority, 'constructor', { value: 1, enumerable: true });

  for (const [label, value] of [['an unknown member', unknown], ['an authority key', authority]]) {
    assert.equal(validateLineageSet(value).reason, 'member-set-mismatch', label);
  }
  assert.equal(validateLineageSet(null).reason, 'not-a-lineage-set');
  assert.equal(validateLineageSet(new Proxy(set(), {})).ok, false);
  assert.equal(validatePrune(null, { lineages: set(), asOf: opened }).reason, 'not-a-prune');
  assert.equal(validatePrune(prune(), { lineages: null, asOf: opened }).ok, false);

  const openRecord = set();
  openRecord.lineages = [{ ...lineage(), note: 'extra' }];
  assert.equal(validateLineageSet(openRecord).reason, 'member-set-mismatch');
});

test('refuses a live object that can answer differently than it serializes', () => {
  assert.equal(validateLineageSet({ toJSON: () => set() }).reason, 'not-a-lineage-set');
  const shifting = set();
  let reads = 0;
  Object.defineProperty(shifting, 'lineages', {
    enumerable: true,
    get() {
      reads += 1;
      return set().lineages;
    },
  });
  assert.equal(validateLineageSet(shifting).reason, 'not-a-lineage-set');
  assert.equal(reads, 0, 'an accessor is refused before it is ever invoked');
});

test('names a token or a position in a denial, never a key or a bucket', () => {
  // A WELL-FORMED key that is merely outside the lineage: a malformed one dies in the
  // grammar and never reaches the path that interpolates a key at all.
  const outside = validatePrune(
    prune({ objects: ['inmoview-prod-gen2/ep-cool.aws.neon.tech.proj_a1b2c3.sql.gz'] }),
    { lineages: set(retained, lineage()), asOf: '2027-01-01T00:00:00.000Z' },
  );
  assert.equal(outside.reason, 'object-outside-lineage');
  assert.equal(outside.detail, 'objects:#0');
  // A key is a deployed identity, and a denial is public evidence.
  assert.doesNotMatch(JSON.stringify(outside), /neon\.tech|proj_a1b2c3|inmoview-prod-gen2/i);

  const malformed = validatePrune(
    prune({ objects: ['s3://inmoview-backups/ep-cool.aws.neon.tech/dump.sql.gz'] }),
    { lineages: set(retained), asOf: '2027-01-01T00:00:00.000Z' },
  );
  assert.equal(malformed.reason, 'object-rejected');
  assert.doesNotMatch(JSON.stringify(malformed), /inmoview-backups|neon\.tech|s3:\/\//i);
});

test('refuses a prune plan that can answer differently than it serializes', () => {
  const lineages = set(retained);
  const asOf = '2027-01-01T00:00:00.000Z';
  assert.equal(validatePrune({ toJSON: () => prune() }, { lineages, asOf }).reason, 'not-a-prune');
  const shifting = prune();
  let reads = 0;
  Object.defineProperty(shifting, 'objects', {
    enumerable: true,
    get() {
      reads += 1;
      return prune().objects;
    },
  });
  assert.equal(validatePrune(shifting, { lineages, asOf }).reason, 'not-a-prune');
  assert.equal(reads, 0, 'an accessor is refused before it is ever invoked');
});

test('refuses to reason about a prune against an unsound lineage set', () => {
  // Retention reasoning rests on the set being collision-free: two lineages under one
  // address make "which lineage is this object retained by" unanswerable.
  const colliding = set(retained, lineage({ prefix: 'inmoview-prod-gen1/nightly' }));
  const result = validatePrune(prune(), { lineages: colliding, asOf: '2027-01-01T00:00:00.000Z' });
  assert.equal(result.reason, 'prefix-collision');
  assert.equal(result.ok, false);

  const duplicated = set(retained, lineage({ generation: 1, prefix: 'other-prefix' }));
  assert.equal(validatePrune(prune(), { lineages: duplicated, asOf: '2027-01-01T00:00:00.000Z' }).reason, 'duplicate-generation');
});

test('rejects a lineage set that names no lineage at all', () => {
  const empty = set();
  empty.lineages = [];
  assert.equal(validateLineageSet(empty).reason, 'member-set-mismatch');
  assert.equal(validateLineageSet(empty).detail, 'lineages');
  assert.equal(validatePrune(prune(), { lineages: empty, asOf: '2027-01-01T00:00:00.000Z' }).ok, false);
});

test('never reports success or an in-band reason for a hostile input', () => {
  // The fault reasons are backstops for states the guards make unreachable, so they
  // cannot be provoked. What is assertable, and what a vacuous literal comparison never
  // proved, is that no hostile input reaches an accepting result.
  const asOf = '2027-01-01T00:00:00.000Z';
  const hostile = [null, undefined, 7, 'text', [], {}, new Date(0), new Map(), () => set()];
  for (const value of hostile) {
    const read = validateLineageSet(value);
    assert.equal(read.ok, false, `set ${String(value)}`);
    assert.equal(read.authority, false);
    const pruned = validatePrune(value, { lineages: set(retained), asOf });
    assert.equal(pruned.ok, false, `prune ${String(value)}`);
    assert.equal(pruned.authority, false);
    assert.equal(validatePrune(prune(), { lineages: value, asOf }).ok, false, `lineages ${String(value)}`);
  }
});

test('denies authority on every path, and removes nothing', () => {
  assert.equal(backupLineageAuthority(), false);
  assert.equal(validateLineageSet(set()).authority, false);
  assert.equal(validateLineageSet({}).authority, false);
  assert.equal(validatePrune(prune(), { lineages: set(retained), asOf: '2027-01-01T00:00:00.000Z' }).authority, false);
  assert.equal(validatePrune({}, { lineages: set(), asOf: opened }).authority, false);
});
