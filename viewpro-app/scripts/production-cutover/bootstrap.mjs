import { types } from 'node:util';

// These predicates exist in near-identical form in roles.mjs, checkpoint.mjs and
// receipt.mjs, because this change's per-work-unit path lists admit no shared module.
// roles.mjs and bootstrap.mjs carry `plain`, `closedRecord`, `authorityKeys`, `snapshot`
// and `denied`; receipt.mjs has no `snapshot` — it uses the stronger `canonicalize`.
// A change here must be mirrored into whichever siblings carry the same predicate.

// Exported so a caller can assert non-authority without supplying a census.
export const bootstrapAuthority = () => false;

// Exactly what a freshly bootstrapped lane may contain. `'any'` means the migration
// ledger, whose row count is whatever the migration history happens to be; every other
// entry pins an exact row count. `'any'` is nominal rather than `null`, because `null` is
// what someone writes when they have not filled a value in, and that mistake would
// silently admit any row count. A table absent from its lane's map is not admitted.
export const allowlists = Object.freeze({
  product: Object.freeze({
    migrationLedger: 'any',
    tenant: 0,
    listing: 0,
    outboxEvent: 0,
  }),
  platform: Object.freeze({
    migrationLedger: 'any',
    ingestCursor: 1,
    operator: 1,
    metric: 0,
    tenantRegistry: 0,
  }),
});

// Each lane activates on its own evidence. A baseline carrying the other lane's members
// is refused outright rather than credited for the members it happens to share.
export const baselineMembers = Object.freeze({
  product: Object.freeze([
    'schemaVersion',
    'kind',
    'lane',
    'imageDigest',
    'readiness',
    'allowlist',
  ]),
  platform: Object.freeze([
    'schemaVersion',
    'kind',
    'lane',
    'imageDigest',
    'readiness',
    'singleton',
    'cursor',
    'operators',
  ]),
});

const censusMembers = Object.freeze(['schemaVersion', 'kind', 'lane', 'tables']);
const authorityKeys = new Set(['__proto__', 'constructor', 'prototype']);
const digestForm = /^sha256:[a-f0-9]{64}$/;

const plain = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !types.isProxy(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));

const closedRecord = (value, names) => {
  if (!plain(value)) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== names.length) return false;
  return keys.every(
    (key) => typeof key === 'string' && !authorityKeys.has(key) && names.includes(key),
  );
};

// `JSON.stringify` honours `toJSON` and invokes accessors, so a live object can hand the
// serializer something other than itself. Refusing both up front makes the round trip
// faithful, which is what lets one snapshot be judged and reused.
const dataOnly = (value, depth = 0) => {
  if (depth > 8) return false;
  if (value === null || ['boolean', 'string', 'number'].includes(typeof value)) return true;
  if (typeof value !== 'object' || types.isProxy(value)) return false;
  if (!Array.isArray(value) && !plain(value)) return false;
  if (Array.isArray(value) && Object.getPrototypeOf(value) !== Array.prototype) return false;
  return Reflect.ownKeys(value).every((key) => {
    if (typeof key !== 'string') return false;
    // An accessor has no `value`, and a `toJSON` is a function; both therefore reach the
    // recursion as a non-data member and are refused there. No separate guard is needed,
    // and adding one would read as load-bearing while proving nothing.
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return dataOnly(descriptor?.value, depth + 1);
  });
};

const snapshot = (value) => JSON.parse(JSON.stringify(value));

// Details name a table or a baseline member, never a deployed identity.
const denied = (reason, detail = '') => ({ ok: false, authority: false, reason, detail });

const lanes = Object.keys(allowlists);

export function validateCensus(live, { lane } = {}) {
  try {
    if (!lanes.includes(lane)) return denied('lane-rejected', 'lane');
    if (!plain(live) || !dataOnly(live)) return denied('not-a-census');

    let census;
    try {
      census = snapshot(live);
    } catch {
      return denied('not-a-census');
    }

    if (!closedRecord(census, censusMembers)) return denied('member-set-mismatch');
    if (census.schemaVersion !== 1) return denied('schema-rejected', 'schemaVersion');
    if (census.kind !== 'production-cutover-census') return denied('kind-rejected', 'kind');
    if (census.lane !== lane) return denied('lane-mismatch', 'lane');
    if (!plain(census.tables)) return denied('member-set-mismatch', 'tables');

    const allowlist = allowlists[lane];
    for (const [index, table] of Object.keys(census.tables).entries()) {
      // Zero rows is not a defence: an unrecognised table is rejected rather than
      // ignored, because skipping it would prove nothing about what went unexamined.
      // Its name is reported by position, because an unrecognised name is not ours.
      if (!Object.hasOwn(allowlist, table)) return denied('unknown-table', `#${index}`);
      const rows = census.tables[table];
      if (!Number.isSafeInteger(rows) || rows < 0) return denied('row-count-rejected', table);
      const expected = allowlist[table];
      if (expected !== 'any' && rows !== expected) return denied('non-allowlisted-row', table);
    }
    for (const table of Object.keys(allowlist)) {
      if (!Object.hasOwn(census.tables, table)) return denied('missing-table', table);
    }

    return { ok: true, authority: false, reason: '', detail: '' };
  } catch {
    // No caller value ever reaches the detail, including through a thrown object.
    return denied('census-faulted');
  }
}

export function validateBaseline(live, { lane, digest } = {}) {
  try {
    if (!lanes.includes(lane)) return denied('lane-rejected', 'lane');
    if (!plain(live) || !dataOnly(live)) return denied('not-a-baseline');
    if (typeof digest !== 'string' || !digestForm.test(digest)) {
      return denied('digest-mismatch', 'imageDigest');
    }

    let baseline;
    try {
      baseline = snapshot(live);
    } catch {
      return denied('not-a-baseline');
    }

    if (!closedRecord(baseline, baselineMembers[lane])) return denied('member-set-mismatch');
    if (baseline.schemaVersion !== 1) return denied('schema-rejected', 'schemaVersion');
    if (baseline.kind !== 'production-cutover-baseline') return denied('kind-rejected', 'kind');
    if (baseline.lane !== lane) return denied('lane-mismatch', 'lane');
    if (baseline.imageDigest !== digest) return denied('digest-mismatch', 'imageDigest');

    // Exactly 200. A 503 proves the container is up and the database is not, which is
    // the case this gate exists to refuse.
    if (baseline.readiness !== 200) return denied('readiness-rejected', 'readiness');

    if (lane === 'product') {
      if (baseline.allowlist !== 'empty') return denied('baseline-rejected', 'allowlist');
    } else if (lane === 'platform') {
      if (baseline.singleton !== true) return denied('baseline-rejected', 'singleton');
      if (baseline.cursor !== 0) return denied('baseline-rejected', 'cursor');
      if (baseline.operators !== 1) return denied('baseline-rejected', 'operators');
    } else {
      return denied('lane-rejected', 'lane');
    }

    return { ok: true, authority: false, reason: '', detail: '' };
  } catch {
    // A distinct code: a crash must never be readable as a routine baseline rejection.
    // No caller value ever reaches the detail, including through a thrown object.
    return denied('baseline-faulted');
  }
}
