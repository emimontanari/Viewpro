import assert from 'node:assert/strict';
import test from 'node:test';

import {
  reversalAuthorities,
  reversalReasons,
  rollbackAuthority,
  validateReversal,
  writeBoundaries,
} from './rollback.mjs';

const asOf = '2026-09-15T00:00:00.000Z';

const authority = (overrides = {}) => ({
  kind: 'reconciliation',
  approvedBy: 'maintainer',
  expiresAt: '2026-10-31T00:00:00.000Z',
  generation: 2,
  ...overrides,
});

const reversal = (overrides = {}) => ({
  schemaVersion: 1,
  kind: 'production-cutover-reversal',
  generation: 2,
  writeBoundary: 'before-first-write',
  freeze: 'held',
  isolation: 'held',
  authorities: [],
  ...overrides,
});

const judge = (value, options = {}) => validateReversal(value, { asOf, ...options });

test('pins the write boundaries and the authorities as frozen literals', () => {
  assert.ok(Object.isFrozen(writeBoundaries));
  assert.ok(Object.isFrozen(reversalAuthorities));
  assert.deepEqual([...writeBoundaries], ['before-first-write', 'after-first-write', 'unknown']);
  assert.deepEqual([...reversalAuthorities], ['reconciliation', 'export']);
});

test('permits a reversal before any business write', () => {
  const result = judge(reversal());
  assert.equal(result.reason, '', result.detail);
  assert.equal(result.ok, true);
  assert.equal(result.authority, false);
});

test('refuses a reversal after the first business write (RED-CUT-12)', () => {
  const result = judge(reversal({ writeBoundary: 'after-first-write' }));
  assert.equal(result.reason, 'authority-required');
  assert.equal(result.detail, 'authorities');
  assert.equal(result.ok, false);
  assert.equal(result.authority, false);
});

test('permits a post-write reversal only with present, unexpired authority', () => {
  for (const kind of reversalAuthorities) {
    const result = judge(reversal({ writeBoundary: 'after-first-write', authorities: [authority({ kind })] }));
    assert.equal(result.ok, true, `${kind} authority must permit the reversal`);
  }
});

test('refuses an authority that is absent, expired, unapproved or malformed (RED-CUT-12)', () => {
  const refused = [
    ['expired', authority({ expiresAt: '2026-01-01T00:00:00.000Z' })],
    ['expiring exactly now', authority({ expiresAt: asOf })],
    ['shaped but impossible', authority({ expiresAt: '9999-99-99T99:99:99.999Z' })],
    ['an impossible day', authority({ expiresAt: '2026-02-31T00:00:00.000Z' })],
    ['free text', authority({ expiresAt: 'soon' })],
    ['unapproved', authority({ approvedBy: '' })],
    ['whitespace approved', authority({ approvedBy: '  ' })],
    ['null approved', authority({ approvedBy: null })],
    ['false approved', authority({ approvedBy: false })],
    ['zero approved', authority({ approvedBy: 0 })],
    ['an unknown kind', authority({ kind: 'vibes' })],
    ['an open record', { ...authority(), note: 'extra' }],
  ];
  for (const [label, entry] of refused) {
    const result = judge(reversal({ writeBoundary: 'after-first-write', authorities: [entry] }));
    assert.equal(result.ok, false, `${label} must not authorise a reversal`);
    assert.equal(result.reason, 'authority-required', label);
  }
});

test('refuses a reversal whose write boundary is unknown (RED-CUT-12)', () => {
  // An unknown boundary is not evidence that no write occurred.
  for (const authorities of [[], [authority()]]) {
    const result = judge(reversal({ writeBoundary: 'unknown', authorities }));
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'write-boundary-unknown');
    assert.equal(result.detail, 'writeBoundary');
  }
});

test('refuses a reversal once freeze or isolation has lapsed', () => {
  for (const member of ['freeze', 'isolation']) {
    const result = judge(reversal({ [member]: 'lapsed' }));
    assert.equal(result.reason, 'containment-lapsed');
    assert.equal(result.detail, member);
    assert.equal(result.ok, false);
  }
});

test('requires a real observation instant rather than a well-shaped one', () => {
  for (const value of [undefined, '', 'today', 0, '9999-99-99T99:99:99.999Z', '2026-02-31T00:00:00.000Z']) {
    const result = validateReversal(reversal(), { asOf: value });
    assert.equal(result.reason, 'as-of-rejected', `asOf=${String(value)}`);
    assert.equal(result.detail, 'asOf');
  }
});

test('rejects an unknown, missing or hostile shape', () => {
  const unknown = reversal();
  unknown.extra = 1;
  const missing = reversal();
  delete missing.isolation;
  // Same arity as a real reversal, with a prototype key REPLACING a member: the arity
  // check cannot fire, so only the authority-key guard can refuse it. Built through
  // JSON.parse because that is how such a key survives a snapshot in practice.
  const keyed = JSON.parse(
    JSON.stringify(reversal()).replace('"generation"', '"__proto__"'),
  );

  for (const [label, value, reason] of [
    ['an unknown member', unknown, 'member-set-mismatch'],
    ['a missing member', missing, 'member-set-mismatch'],
    // A prototype key REPLACING a member, so the arity check cannot fire and the name
    // membership check is what refuses it. The dedicated authority-key set is dominated
    // by that check, so this case names the rule that actually applies.
    ['a prototype key in place of a member', keyed, 'member-set-mismatch'],
    ['a wrong schema version', reversal({ schemaVersion: 2 }), 'schema-rejected'],
    ['a foreign kind', reversal({ kind: 'production-cutover-checkpoint' }), 'kind-rejected'],
    ['an unknown boundary', reversal({ writeBoundary: 'maybe' }), 'write-boundary-rejected'],
    ['a bad containment', reversal({ freeze: 'maybe' }), 'containment-rejected'],
    ['a zero generation', reversal({ generation: 0 }), 'generation-rejected'],
    ['a non-array authorities', reversal({ authorities: 'nope' }), 'member-set-mismatch'],
  ]) {
    const result = judge(value);
    assert.equal(result.reason, reason, label);
    assert.equal(result.authority, false, label);
  }
  assert.equal(judge(null).reason, 'not-a-reversal');
  assert.equal(judge(new Proxy(reversal(), {})).ok, false);
});

test('refuses a live object that can answer differently than it serializes', () => {
  assert.equal(judge({ toJSON: () => reversal() }).reason, 'not-a-reversal');
  const shifting = reversal();
  let reads = 0;
  Object.defineProperty(shifting, 'writeBoundary', {
    enumerable: true,
    get() {
      reads += 1;
      return 'before-first-write';
    },
  });
  assert.equal(judge(shifting).reason, 'not-a-reversal');
  assert.equal(reads, 0, 'an accessor is refused before it is ever invoked');
});

test('names a member, never a caller value, whether refused or permitted', () => {
  const leaky = 'postgres://u:pw@ep-cool.aws.neon.tech/app';
  const carries = /postgres:\/\/|neon\.tech|ep-cool/i;

  // Refused because the value is not a boundary: the refusal names the member only.
  const refused = judge(reversal({ writeBoundary: leaky }));
  assert.equal(refused.reason, 'write-boundary-rejected');
  assert.equal(refused.detail, 'writeBoundary');
  assert.doesNotMatch(JSON.stringify(refused), carries);

  // Refused because no authority licenses it, while one carries the hostile value.
  const unlicensed = judge(
    reversal({
      writeBoundary: 'after-first-write',
      authorities: [authority({ kind: leaky, approvedBy: leaky })],
    }),
  );
  assert.equal(unlicensed.reason, 'authority-required');
  assert.doesNotMatch(JSON.stringify(unlicensed), carries);

  // Permitted: an odd approver name is still an approver, and the result still carries
  // nothing of it. A success is evidence too.
  const permitted = judge(
    reversal({ writeBoundary: 'after-first-write', authorities: [authority({ approvedBy: leaky })] }),
  );
  assert.equal(permitted.ok, true);
  assert.doesNotMatch(JSON.stringify(permitted), carries);
  assert.deepEqual(Object.keys(permitted), ['ok', 'authority', 'reason', 'detail']);
});

test('denies authority on every path, and reverses nothing itself', () => {
  assert.equal(rollbackAuthority(), false);
  assert.equal(judge(reversal()).authority, false);
  assert.equal(judge({}).authority, false);
  assert.equal(judge(null).authority, false);
});

test('publishes a closed refusal vocabulary', () => {
  assert.ok(Object.isFrozen(reversalReasons));
  assert.equal(new Set(reversalReasons).size, reversalReasons.length);
});

test('names only a vocabulary token in every refusal, and never a caller value', () => {
  // The previous shape of this test covered two of twelve refusal paths. Each entry
  // below drives a DIFFERENT `denied(...)` site with a hostile value in the member that
  // site inspects, so a detail that echoed its input would be caught wherever it lives.
  const leaky = 'postgres://u:pw@ep-cool.aws.neon.tech/app';
  const carries = /postgres:\/\/|neon\.tech|ep-cool/i;
  const hostile = [
    ['not a reversal at all', leaky, {}],
    ['a hostile schema version', reversal({ schemaVersion: leaky }), {}],
    ['a hostile kind', reversal({ kind: leaky }), {}],
    ['a hostile generation', reversal({ generation: leaky }), {}],
    ['a hostile boundary', reversal({ writeBoundary: leaky }), {}],
    ['a hostile containment', reversal({ freeze: leaky }), {}],
    ['a hostile extra member', { ...reversal(), [leaky]: 1 }, {}],
    ['a hostile authorities member', reversal({ authorities: leaky }), {}],
    ['a hostile authority kind', reversal({ writeBoundary: 'after-first-write', authorities: [authority({ kind: leaky })] }), {}],
    ['a hostile observation instant', reversal(), { asOf: leaky }],
  ];
  for (const [label, value, options] of hostile) {
    const result = validateReversal(value, { asOf, ...options });
    assert.equal(result.ok, false, label);
    assert.ok(reversalReasons.includes(result.reason), `${label}: ${result.reason} must be a known reason`);
    assert.doesNotMatch(JSON.stringify(result), carries, `${label} must not echo its input`);
  }

  // A permitted result is evidence too. An odd approver name is still an approver —
  // this module judges a name's presence, never its content — so the reversal is
  // permitted and the result must still carry nothing of it.
  const permitted = judge(
    reversal({ writeBoundary: 'after-first-write', authorities: [authority({ approvedBy: leaky })] }),
  );
  assert.equal(permitted.ok, true);
  assert.doesNotMatch(JSON.stringify(permitted), carries);
  assert.deepEqual(Object.keys(permitted), ['ok', 'authority', 'reason', 'detail']);
});

test('binds an authority to the generation it licences', () => {
  const forAnother = judge(
    reversal({ writeBoundary: 'after-first-write', authorities: [authority({ generation: 3 })] }),
  );
  assert.equal(forAnother.reason, 'authority-required', 'an authority for another generation licences nothing');
  const unbound = judge(
    reversal({ writeBoundary: 'after-first-write', authorities: [{ kind: 'reconciliation', approvedBy: 'm', expiresAt: '2026-10-31T00:00:00.000Z' }] }),
  );
  assert.equal(unbound.reason, 'authority-required', 'an authority naming no generation is a bearer grant');
});

test('refuses an authority whose expiry never arrives', () => {
  // "Unexpired" is satisfied by an expiry a century away, which is a standing licence
  // rather than a grant scoped to one cutover.
  const distant = judge(
    reversal({ writeBoundary: 'after-first-write', authorities: [authority({ expiresAt: '2126-01-01T00:00:00.000Z' })] }),
  );
  assert.equal(distant.reason, 'authority-required');
});

test('reads a whole authority list, not one end of it', () => {
  const bad = authority({ approvedBy: '' });
  const good = authority();
  for (const [label, authorities] of [
    ['a valid authority last', [bad, good]],
    ['a valid authority first', [good, bad]],
  ]) {
    const result = judge(reversal({ writeBoundary: 'after-first-write', authorities }));
    assert.equal(result.ok, true, label);
  }
});

test('refuses a containment value outside its vocabulary', () => {
  for (const member of ['freeze', 'isolation']) {
    for (const value of ['partial', 'unknown', '', true, null]) {
      const result = judge(reversal({ [member]: value }));
      assert.equal(result.reason, 'containment-rejected', `${member}=${String(value)}`);
      assert.equal(result.detail, member);
    }
  }
  // When both lapse, the refusal names the first, so the evidence is deterministic.
  const both = judge(reversal({ freeze: 'lapsed', isolation: 'lapsed' }));
  assert.equal(both.reason, 'containment-lapsed');
  assert.equal(both.detail, 'freeze');
});

test('refuses a value whose prototype is not a plain object', () => {
  class Reversal {}
  for (const [label, value] of [
    ['a class instance', Object.assign(new Reversal(), reversal())],
    ['a Date', new Date()],
    ['a Map', new Map()],
    ['an Error', new Error('boom')],
    ['an array', []],
  ]) {
    assert.equal(judge(value).reason, 'not-a-reversal', label);
  }
  // A nested non-plain value is refused too, before it is ever serialized.
  assert.equal(judge({ ...reversal(), authorities: [new Date()] }).ok, false);
});

test('refuses excessive nesting rather than recursing without bound', () => {
  const deep = { ...reversal(), authorities: [Array.from({ length: 12 }).reduce((nested) => ({ nested }), {})] };
  assert.equal(judge(deep).reason, 'not-a-reversal');
});

test('holds the value domains it claims', () => {
  for (const [label, value, reason] of [
    ['a stringified schema version', reversal({ schemaVersion: '1' }), 'schema-rejected'],
    ['a fractional generation', reversal({ generation: 2.5 }), 'generation-rejected'],
    ['a stringified generation', reversal({ generation: '2' }), 'generation-rejected'],
    ['a boolean generation', reversal({ generation: true }), 'generation-rejected'],
    ['an unsafe generation', reversal({ generation: 2 ** 53 }), 'generation-rejected'],
  ]) {
    assert.equal(judge(value).reason, reason, label);
  }
});

test('settles rather than throwing on a hostile options object', () => {
  // Destructuring in a parameter list sits outside the body's guard, so a null options
  // object used to throw past the backstop instead of denying.
  for (const options of [null, undefined, 0, 'today', [], { asOf: null }]) {
    const result = validateReversal(reversal(), options);
    assert.equal(result.reason, 'as-of-rejected', `options=${JSON.stringify(options) ?? String(options)}`);
    assert.equal(result.authority, false);
  }
});

test('refuses a record whose member names are wrong at the right arity', () => {
  const renamed = JSON.parse(JSON.stringify(reversal()).replace('"isolation"', '"isolatiom"'));
  assert.equal(judge(renamed).reason, 'member-set-mismatch');
});
