import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import test from 'node:test';

import {
  canonicalize,
  receiptAuthority,
  receiptDenials,
  receiptDigest,
  receiptStates,
  redact,
  validateReceipt,
} from './receipt.mjs';

const keyVersion = 'cutover-2026-08';
const key = Buffer.from('a'.repeat(64), 'hex');
const message = (version, value) => `${version.length}:${version}${value}`;
const generation = 4;

const reference = (value) => redact(value, { keyVersion, key });

// One complete, valid public receipt. Each test mutates a single member of a fresh copy.
const receipt = () => ({
  schemaVersion: 1,
  kind: 'production-cutover-receipt',
  generation,
  state: 'staged',
  digest: '',
  versions: { product: '1.4.0', platform: '1.4.0' },
  aliases: ['cutover-a', 'cutover-b'],
  base: '868dc70f0d9e3c4a1b5f2e6d7c8a9b0e1f2a3b4c',
  patches: ['faf870ab0a29e6a271b7391776fc2f9cf25c12ac', 'd53a57c04f34efd20fc825aff5c03115c9c6c99f'],
  tree: '07432ec4803668ee792404483656d5c0fa85ce5e',
  pathDigests: { 'viewpro-app': 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391' },
  imageDigests: { product: `sha256:${'b'.repeat(64)}` },
  deployment: { product: reference('inmoview-app'), platform: reference('inmoview-console') },
  secrets: [reference('PLATFORM_CONTROL_SECRET')],
  backup: { lineage: reference('backup-lineage-1'), heartbeat: '2026-08-26T00:00:00.000Z' },
  evidence: { qualification: `sha256:${'c'.repeat(64)}` },
  timestamps: { staged: '2026-08-26T00:00:00.000Z' },
});

const sealed = () => {
  const value = receipt();
  value.digest = receiptDigest({ ...value, digest: '' });
  return value;
};

test('canonicalizes to RFC 8785 form regardless of member order', () => {
  const carriageReturn = String.fromCharCode(13);
  const ordered = { [carriageReturn]: 'CR', 1: 'One', 'ö': 'o', '€': 'Euro' };
  const shuffled = { '€': 'Euro', 1: 'One', [carriageReturn]: 'CR', 'ö': 'o' };
  // Members order by UTF-16 code units, with no insignificant whitespace.
  assert.equal(canonicalize(ordered), canonicalize(shuffled));
  // Carriage return is U+000D and "1" is U+0031, so the control character sorts first.
  assert.equal(canonicalize(ordered), '{"\\r":"CR","1":"One","ö":"o","€":"Euro"}');
});

test('matches RFC 8785 number serialization exactly', () => {
  for (const [value, expected] of [
    [0, '0'],
    [-0, '0'],
    [0.1, '0.1'],
    [-1.5, '-1.5'],
    [1e30, '1e+30'],
    [1e-30, '1e-30'],
    [5e-324, '5e-324'],
    [1.7976931348623157e308, '1.7976931348623157e+308'],
    [9007199254740992, '9007199254740992'],
  ]) {
    assert.equal(canonicalize(value), expected, `${value} must canonicalize to ${expected}`);
  }
});

test('refuses every lossy or hostile value rather than emitting one', () => {
  const cyclic = { name: 'cycle' };
  cyclic.self = cyclic;
  const hostile = [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    undefined,
    () => 'fn',
    Symbol('s'),
    10n,
    cyclic,
    { lone: String.fromCharCode(0xd800) },
    Object.assign(Object.create({ inherited: true }), { own: 1 }),
    new Proxy({ a: 1 }, {}),
    new Date(0),
    new Map(),
    { nested: [{ deep: Number.NaN }] },
  ];
  for (const value of hostile) {
    // A TypeError specifically: a stack overflow from unguarded recursion would satisfy
    // a bare `throws` while being a crash rather than a refusal.
    assert.throws(() => canonicalize(value), TypeError, `${String(value)} must fail closed`);
  }
});

test('digests the canonical bytes in process', () => {
  const value = { b: 2, a: 1 };
  const expected = createHash('sha256').update(Buffer.from(canonicalize(value), 'utf8')).digest('hex');
  assert.equal(receiptDigest(value), `sha256:${expected}`);
  assert.equal(receiptDigest({ a: 1, b: 2 }), receiptDigest(value));
});

test('accepts one complete sealed receipt', () => {
  const result = validateReceipt(sealed(), { generation });
  assert.equal(result.reason, '', result.detail);
  assert.equal(result.ok, true);
  assert.equal(result.authority, false);
});

test('redacts under a named key version, stably and without revealing the source', () => {
  const once = redact('inmoview-app', { keyVersion, key });
  const twice = redact('inmoview-app', { keyVersion, key });
  const elsewhere = redact('inmoview-app', { keyVersion: 'cutover-2026-09', key });
  assert.deepEqual(once, twice, 'the same source and key version must correlate');
  assert.notEqual(once.hmac, elsewhere.hmac, 'a different key version must not correlate');
  assert.equal(once.keyVersion, keyVersion);
  assert.match(once.hmac, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(once), /inmoview-app/);
  // A plain digest of the source must never be what correlates it.
  assert.notEqual(once.hmac, createHash('sha256').update('inmoview-app').digest('hex'));
  assert.equal(
    once.hmac,
    createHmac('sha256', key).update(message(keyVersion, 'inmoview-app')).digest('hex'),
  );
});

test('encodes the key version unambiguously, so distinct pairs cannot collide', () => {
  // A single separator would make these identical: 'v1' + ' ' + 'us east-2 prod'
  // and 'v1 us' + ' ' + 'east-2 prod' are the same bytes.
  const left = redact('us east-2 prod', { keyVersion: 'v1', key });
  const right = redact('east-2 prod', { keyVersion: 'v1 us', key });
  assert.notEqual(left.hmac, right.hmac, 'the key version must be length delimited');
});

test('refuses a key below the entropy floor, and a missing or unnamed key version', () => {
  for (const options of [
    { keyVersion, key: Buffer.alloc(31) },
    { keyVersion, key: Buffer.from('a') },
    { keyVersion, key: 'not-a-buffer' },
    { keyVersion, key: undefined },
    { keyVersion: '', key },
    { keyVersion: undefined, key },
  ]) {
    assert.throws(() => redact('inmoview-app', options), TypeError);
  }
  assert.throws(() => redact('', { keyVersion, key }), TypeError);
  assert.throws(() => redact(42, { keyVersion, key }), TypeError);
});

test('pins the permitted receipt states', () => {
  assert.ok(Object.isFrozen(receiptStates));
  assert.deepEqual([...receiptStates], ['staged', 'activated', 'closed']);
  for (const state of receiptStates) {
    const candidate = receipt();
    candidate.state = state;
    candidate.digest = receiptDigest({ ...candidate, digest: '' });
    assert.equal(validateReceipt(candidate, { generation }).ok, true, `${state} must be accepted`);
  }
});

test('refuses a raw shape in a member NAME, not only in a value', () => {
  const named = [
    ['pathDigests', { 'ep-cool-darkness-123456.us-east-2.aws.neon.tech': 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391' }],
    ['evidence', { 'postgres://neondb_owner:pw@db.internal:5432/app': `sha256:${'c'.repeat(64)}` }],
    ['versions', { proj_a1b2c3d4e5f6: '1.4.0' }],
    ['timestamps', { 'https://console.neon.tech/x': '2026-08-26T00:00:00.000Z' }],
    ['versions', { nested: { 'db.internal.corp.net': '1.0.0' } }],
  ];
  for (const [member, value] of named) {
    const candidate = receipt();
    candidate[member] = value;
    candidate.digest = receiptDigest({ ...candidate, digest: '' });
    const result = validateReceipt(candidate, { generation });
    assert.equal(result.ok, false, `a raw name in ${member} must be rejected`);
    assert.equal(result.reason, 'unredacted-content');
  }
});

test('refuses a raw shape hidden in a key version', () => {
  const hidden = [
    ['secrets', { keyVersion: 'ep-cool-darkness-123456.us-east-2.aws.neon.tech', hmac: 'd'.repeat(64) }],
    ['secrets', { keyVersion: 'postgres://u:pw@db.internal/app', hmac: 'd'.repeat(64) }],
  ];
  for (const [, broken] of hidden) {
    const candidate = receipt();
    candidate.secrets = [broken];
    candidate.digest = receiptDigest({ ...candidate, digest: '' });
    const result = validateReceipt(candidate, { generation });
    assert.equal(result.ok, false, 'a key version is cleartext and must be scanned');
    assert.equal(result.reason, 'unredacted-content');
  }
});

test('refuses an open backup record', () => {
  for (const note of [
    // Innocuous: only the closed-record rule can reject this, never the content scan.
    'ok',
    'postgres://user:pw@db.internal:5432/app',
  ]) {
    const candidate = receipt();
    candidate.backup = {
      lineage: reference('backup-lineage-1'),
      heartbeat: '2026-08-26T00:00:00.000Z',
      note,
    };
    candidate.digest = receiptDigest({ ...candidate, digest: '' });
    const result = validateReceipt(candidate, { generation });
    assert.equal(result.reason, 'unredacted-content', `backup carrying ${note}`);
    assert.equal(result.detail, 'backup');
  }
});

test('names the offending member in a denial, never its value', () => {
  // A denial is public evidence too, so echoing the value would leak exactly what
  // redaction exists to withhold.
  const leaky = 'postgres://neondb_owner:hunter2@ep-x.aws.neon.tech/app';
  const candidate = receipt();
  candidate.state = leaky;
  candidate.digest = receiptDigest({ ...candidate, digest: '' });
  const result = validateReceipt(candidate, { generation });
  assert.equal(result.reason, 'state-rejected');
  assert.equal(result.detail, 'state');
  assert.doesNotMatch(JSON.stringify(result), /hunter2|neon\.tech|neondb_owner/);
});

test('binds the members it claims to bind, rather than accepting any value', () => {
  const rejected = [
    ['pathDigests', { 'viewpro-app': 'not-40-hex' }, 'path-digests-rejected'],
    ['pathDigests', { 'viewpro-app': 12345 }, 'path-digests-rejected'],
    ['imageDigests', { product: 'latest' }, 'image-digests-rejected'],
    ['imageDigests', { product: null }, 'image-digests-rejected'],
    ['timestamps', { staged: 'yesterday afternoon' }, 'timestamps-rejected'],
    ['timestamps', { staged: 0 }, 'timestamps-rejected'],
    ['versions', 42, 'versions-rejected'],
    ['base', 'not-an-identity', 'base-rejected'],
    ['tree', '0'.repeat(39), 'tree-rejected'],
    ['patches', ['not-an-identity'], 'patches-rejected'],
    ['aliases', [7], 'aliases-rejected'],
  ];
  for (const [member, value, reason] of rejected) {
    const candidate = receipt();
    candidate[member] = value;
    candidate.digest = receiptDigest({ ...candidate, digest: '' });
    const result = validateReceipt(candidate, { generation });
    assert.equal(result.reason, reason, `${member} = ${JSON.stringify(value)}`);
    assert.equal(result.ok, false);
  }
  assert.equal(validateReceipt(sealed(), { generation: -1 }).reason, 'generation-mismatch');
});

test('rejects a wrong schema version or a foreign kind', () => {
  for (const [member, value, reason] of [
    ['schemaVersion', 2, 'schema-rejected'],
    ['kind', 'production-cutover-checkpoint', 'kind-rejected'],
  ]) {
    const candidate = receipt();
    candidate[member] = value;
    candidate.digest = receiptDigest({ ...candidate, digest: '' });
    assert.equal(validateReceipt(candidate, { generation }).reason, reason);
  }
});

test('validates a data-only snapshot, so no accessor or hidden member escapes the digest', () => {
  // An own non-enumerable member passes an ownKeys count yet vanishes from a spread, so a
  // validator that digests a projection would bind two different trees to one identity.
  const hidden = receipt();
  hidden.digest = receiptDigest({ ...hidden, digest: '' });
  Object.defineProperty(hidden, 'tree', { value: '1'.repeat(40), enumerable: false });
  // The reason is what discriminates: a snapshot never sees the member at all, so the
  // member set is short. Validating the live object would instead reach the digest and
  // report a mismatch, which is the shape that let two trees share one identity.
  assert.equal(validateReceipt(hidden, { generation }).reason, 'member-set-mismatch');

  // A getter that answers differently on each read must not let the scanned view and the
  // digested view disagree.
  let reads = 0;
  const shifting = receipt();
  Object.defineProperty(shifting, 'versions', {
    enumerable: true,
    get() {
      reads += 1;
      return reads === 1 ? { product: '1.4.0' } : { product: 'ep-x.us-east-2.aws.neon.tech' };
    },
  });
  const result = validateReceipt(shifting, { generation });
  assert.equal(result.ok, false, 'a shifting member must never validate');
  // One read only: the snapshot is taken once, so the scanned and digested views are the
  // same bytes by construction rather than by luck.
  assert.equal(reads, 1, 'the live object must be read exactly once');
});

test('canonicalizes a shared reference as a DAG but refuses a cycle', () => {
  const shared = { a: 1 };
  // The same object down two branches is a DAG: JSON semantics, and reproducible.
  assert.equal(canonicalize({ x: shared, y: shared }), '{"x":{"a":1},"y":{"a":1}}');
  const cyclic = { name: 'c' };
  cyclic.self = cyclic;
  assert.throws(() => canonicalize(cyclic), TypeError);
});

test('refuses excessive depth rather than exhausting the stack', () => {
  let deep = { end: true };
  for (let level = 0; level < 200; level += 1) deep = { deep };
  assert.throws(() => canonicalize(deep), TypeError, 'depth must fail closed, not crash');
  let shallow = { end: true };
  for (let level = 0; level < 40; level += 1) shallow = { shallow };
  assert.equal(typeof canonicalize(shallow), 'string');
});

test('refuses a lone surrogate in a member name, not only in a value', () => {
  assert.throws(() => canonicalize({ [String.fromCharCode(0xd800)]: 'x' }), TypeError);
});

test('rejects a raw secret, host, role, project identifier or provider response (RED-CUT-05)', () => {
  const raw = [
    ['secrets', ['hunter2']],
    ['secrets', ['-----BEGIN PRIVATE KEY-----']],
    ['deployment', { product: 'ep-cool-darkness-123456.us-east-2.aws.neon.tech' }],
    ['deployment', { product: 'postgres://user:pw@db.internal:5432/app' }],
    ['deployment', { product: 'https://inmoview-app.vercel.app' }],
    ['deployment', { product: { role: 'neondb_owner' } }],
    ['backup', { lineage: 'br-still-mud-12345678', heartbeat: '2026-08-26T00:00:00.000Z' }],
    ['evidence', { qualification: 'proj_a1b2c3d4e5f6' }],
    // `versions` and `pathDigests` have no structural redaction rule, so these reach
    // only the content scan.
    ['versions', { product: '1.4.0', platform: 'ep-cool-darkness.aws.neon.tech' }],
    ['versions', { product: 'https://console.neon.tech/app/projects/abc' }],
    ['pathDigests', { 'viewpro-app': 'svc-cutover_owner' }],
    // One case per pattern whose only defence is the content scan.
    ['versions', { product: '-----BEGIN PRIVATE KEY-----' }],
    ['versions', { product: 'redis://localhost:6379' }],
    ['versions', { product: 'proj_a1b2c3d4e5f6' }],
    ['versions', { product: 'br-still-mud-a5xk3p2q' }],
    ['versions', { product: 'sk_live_51H8xk2eZvKYlo2C0' }],
    ['versions', { product: 'AKIAIOSFODNN7EXAMPLE' }],
    ['versions', { product: 'npg_A1b2C3d4E5f6G7h8' }],
    ['versions', { product: '10.0.3.17' }],
  ];
  for (const [member, value] of raw) {
    const candidate = receipt();
    candidate[member] = value;
    candidate.digest = receiptDigest({ ...candidate, digest: '' });
    const result = validateReceipt(candidate, { generation });
    assert.equal(result.ok, false, `${member} carrying ${JSON.stringify(value)} must be rejected`);
    assert.equal(result.reason, 'unredacted-content');
    assert.equal(result.detail, member);
    assert.equal(result.authority, false);
  }
});

test('rejects a correlation that is a plain hash or names no key version', () => {
  for (const broken of [
    { hmac: 'd'.repeat(64) },
    { keyVersion: '', hmac: 'd'.repeat(64) },
    { keyVersion, hmac: 'not-hex' },
    { keyVersion, hmac: 'd'.repeat(63) },
    { keyVersion, hmac: 'd'.repeat(64), source: 'inmoview-app' },
  ]) {
    const candidate = receipt();
    candidate.secrets = [broken];
    candidate.digest = receiptDigest({ ...candidate, digest: '' });
    const result = validateReceipt(candidate, { generation });
    assert.equal(result.ok, false, `${JSON.stringify(broken)} must be rejected`);
    assert.equal(result.reason, 'unredacted-content');
  }
});

test('rejects a wrong generation, digest or state (RED-CUT-07)', () => {
  const wrongState = receipt();
  wrongState.state = 'promoted';
  wrongState.digest = receiptDigest({ ...wrongState, digest: '' });
  const wrongDigest = sealed();
  wrongDigest.digest = `sha256:${'e'.repeat(64)}`;
  const tampered = sealed();
  tampered.tree = '0'.repeat(40);

  assert.equal(validateReceipt(sealed(), { generation: generation + 1 }).reason, 'generation-mismatch');
  for (const [candidate, reason] of [
    [wrongState, 'state-rejected'],
    [wrongDigest, 'digest-mismatch'],
    [tampered, 'digest-mismatch'],
  ]) {
    const result = validateReceipt(candidate, { generation });
    assert.equal(result.reason, reason);
    assert.equal(result.ok, false);
    assert.equal(result.authority, false);
  }
});

test('never lets a public alias override the receipt identity', () => {
  const candidate = sealed();
  candidate.aliases = ['cutover-a', candidate.digest.replace('sha256:', '')];
  const result = validateReceipt(candidate, { generation });
  assert.equal(result.reason, 'alias-shadows-identity');
  assert.equal(result.ok, false);
});

test('rejects an unknown, missing or authority-keyed member', () => {
  const unknown = sealed();
  unknown.extra = 1;
  const missing = sealed();
  delete missing.tree;
  const authority = receipt();
  Object.defineProperty(authority, 'constructor', { value: 1, enumerable: true });
  authority.digest = receiptDigest({ ...authority, digest: '' });

  for (const [label, candidate, reason] of [
    ['an unknown member', unknown, 'member-set-mismatch'],
    ['a missing member', missing, 'member-set-mismatch'],
    ['an authority key', authority, 'member-set-mismatch'],
  ]) {
    const result = validateReceipt(candidate, { generation });
    assert.equal(result.reason, reason, label);
    assert.equal(result.authority, false, label);
  }
  assert.equal(validateReceipt(null, { generation }).reason, 'not-a-receipt');
  assert.equal(validateReceipt(new Proxy(sealed(), {}), { generation }).ok, false);
});

test('denies authority on every path', () => {
  assert.equal(receiptAuthority(), false);
  assert.equal(validateReceipt(sealed(), { generation }).authority, false);
  assert.equal(validateReceipt({}, { generation }).authority, false);
  assert.ok(receiptDenials.includes('provider'));
  assert.ok(Object.isFrozen(receiptDenials));
});
