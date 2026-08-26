import { types } from 'node:util';

// These predicates exist in near-identical form in roles.mjs, bootstrap.mjs,
// checkpoint.mjs and receipt.mjs, because this change's per-work-unit path lists admit
// no shared module. This file carries `plain`, `closedRecord`, `authorityKeys`,
// `dataOnly`, `snapshot` and `denied`; receipt.mjs has no `snapshot` — it uses the
// stronger `canonicalize`. A change here must be mirrored into whichever siblings carry
// the same predicate.

// Mirrors `lanes` in roles.mjs and the keys of `allowlists` in bootstrap.mjs.
export const backupLanes = Object.freeze(['product', 'platform']);

// Exported so a caller can assert non-authority without supplying a lineage.
export const backupLineageAuthority = () => false;

const lineageMembers = Object.freeze([
  'schemaVersion',
  'kind',
  'lane',
  'generation',
  'prefix',
  'retentionOpenedAt',
]);
const setMembers = Object.freeze(['schemaVersion', 'kind', 'lineages']);
const pruneMembers = Object.freeze(['schemaVersion', 'kind', 'prefix', 'objects']);

const authorityKeys = new Set(['__proto__', 'constructor', 'prototype']);
const instantForm = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// One or more segments of safe key characters, joined by single slashes, with no leading
// or trailing slash and no relative segment. This grammar governs whole object keys as
// well as prefixes — a prefix is a key path here — because a wildcard or a traversal in
// either would let one lineage's scan or prune reach another's objects.
const keyForm = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;

// Epoch milliseconds for a real instant, or NaN. Not merely a well-shaped one: a shaped
// but impossible date either parses to nothing (month 13, hour 25) or to a different day
// (31 February), and either would silently move a retention boundary.
const epochOf = (value) => {
  if (typeof value !== 'string' || !instantForm.test(value)) return Number.NaN;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return Number.NaN;
  return new Date(parsed).toISOString() === value ? parsed : Number.NaN;
};

// One calendar month, not thirty days: thirty days is short of a month for most months of
// the year and would delete rollback evidence a day early. A day that does not exist in
// the following month OVERFLOWS to the first of the month after, so 31 January yields
// 1 March. Clamping to 28 February would make the window twenty-eight days — shorter than
// the thirty-day rule this replaces — and a retention boundary is a floor, so it must
// round up. Returns NaN rather than a sentinel string, so an unusable value cannot
// compare as "not retained".
export function retainedUntil(openedAt) {
  const opened = epochOf(openedAt);
  if (!Number.isFinite(opened)) return Number.NaN;
  const date = new Date(opened);
  const target = new Date(date);
  target.setUTCMonth(target.getUTCMonth() + 1);
  // `setUTCMonth` already rolls a non-existent day forward, which is the wanted floor.
  return target.getTime();
}

// Any leading-string overlap, judged from position zero. An object store lists by byte
// prefix with no path semantics, so a retained `inmoview-prod-gen2` is swept by a scan of
// a fresh `inmoview-prod` even though no whole path segment is shared. Segment-only
// judgement would call that pair distinct, which is exactly the sweep this rule exists to
// prevent. Generations must therefore be their own segment (`prod/gen2`), never a suffix.
// A non-string cannot be compared, and a safety predicate that cannot tell must answer
// "colliding" rather than "distinct".
export function collides(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return true;
  return left.startsWith(right) || right.startsWith(left);
}

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
    // recursion as a non-data member and are refused there.
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return dataOnly(descriptor?.value, depth + 1);
  });
};

const snapshot = (value) => JSON.parse(JSON.stringify(value));

// Details name a closed-vocabulary token or a position, never a key: a key is a deployed
// identity, and a denial is public evidence.
const denied = (reason, detail = '') => ({ ok: false, authority: false, reason, detail });

const readLineages = (live, notARecord) => {
  if (!plain(live) || !dataOnly(live)) return denied(notARecord);
  let value;
  try {
    value = snapshot(live);
  } catch {
    return denied(notARecord);
  }
  if (!closedRecord(value, setMembers)) return denied('member-set-mismatch');
  if (value.schemaVersion !== 1) return denied('schema-rejected', 'schemaVersion');
  if (value.kind !== 'production-cutover-backup-lineage-set') return denied('kind-rejected', 'kind');
  if (!Array.isArray(value.lineages) || value.lineages.length === 0) {
    return denied('member-set-mismatch', 'lineages');
  }

  for (const [index, entry] of value.lineages.entries()) {
    const at = `lineages:#${index}`;
    if (!closedRecord(entry, lineageMembers)) return denied('member-set-mismatch', at);
    if (entry.schemaVersion !== 1) return denied('schema-rejected', at);
    if (entry.kind !== 'production-cutover-backup-lineage') return denied('kind-rejected', at);
    if (!backupLanes.includes(entry.lane)) return denied('lane-rejected', at);
    if (!Number.isSafeInteger(entry.generation) || entry.generation < 1) {
      return denied('generation-rejected', at);
    }
    if (typeof entry.prefix !== 'string' || !keyForm.test(entry.prefix)) {
      return denied('prefix-rejected', at);
    }
    if (!Number.isFinite(epochOf(entry.retentionOpenedAt))) {
      return denied('retention-opened-rejected', at);
    }
  }
  // Only `lineages` is read by either caller, so the envelope carries nothing else that
  // could drift out of step with what the exported validators actually return.
  return { ok: true, lineages: value.lineages };
};

export function validateLineageSet(live) {
  try {
    const read = readLineages(live, 'not-a-lineage-set');
    if (!read.ok) return read;

    for (const [index, entry] of read.lineages.entries()) {
      for (const [other, sibling] of read.lineages.entries()) {
        if (other <= index) continue;
        if (entry.lane === sibling.lane && entry.generation === sibling.generation) {
          return denied('duplicate-generation', `lineages:#${other}`);
        }
        if (collides(entry.prefix, sibling.prefix)) {
          return denied('prefix-collision', `lineages:#${other}`);
        }
      }
    }

    return { ok: true, authority: false, reason: '', detail: '' };
  } catch {
    // No caller value ever reaches the detail, including through a thrown object.
    // Unreachable for the same reason as `prune-faulted`, and declared on the same terms.
    return denied('lineage-faulted');
  }
}

export function validatePrune(live, { lineages, asOf } = {}) {
  try {
    const observedAt = epochOf(asOf);
    if (!Number.isFinite(observedAt)) return denied('as-of-rejected', 'asOf');

    const known = readLineages(lineages, 'not-a-lineage-set');
    if (!known.ok) return known;
    const validated = validateLineageSet(lineages);
    if (!validated.ok) return validated;

    if (!plain(live) || !dataOnly(live)) return denied('not-a-prune');
    let plan;
    try {
      plan = snapshot(live);
    } catch {
      return denied('not-a-prune');
    }
    if (!closedRecord(plan, pruneMembers)) return denied('member-set-mismatch');
    if (plan.schemaVersion !== 1) return denied('schema-rejected', 'schemaVersion');
    if (plan.kind !== 'production-cutover-prune-plan') return denied('kind-rejected', 'kind');
    if (typeof plan.prefix !== 'string' || !keyForm.test(plan.prefix)) {
      return denied('prefix-rejected', 'prefix');
    }
    if (!Array.isArray(plan.objects)) return denied('member-set-mismatch', 'objects');
    // A prune that names nothing is refused rather than reported as a success, so an
    // empty plan can never stand in as evidence that a prune was evaluated.
    if (plan.objects.length === 0) return denied('empty-prune', 'objects');

    const owner = known.lineages.find((entry) => entry.prefix === plan.prefix);
    if (owner === undefined) return denied('unknown-lineage', 'prefix');

    for (const [index, key] of plan.objects.entries()) {
      const at = `objects:#${index}`;
      if (typeof key !== 'string' || !keyForm.test(key)) return denied('object-rejected', at);
      // Authorised for one lineage, so it may never reach across to another. A whole
      // path segment, not a leading string: `gen1` must not admit `gen10`.
      if (!key.startsWith(`${plan.prefix}/`)) return denied('object-outside-lineage', at);
    }

    // Every lineage the plan reaches, not only the owner. Reducing this to the owner is
    // sound only while `collides` and the object test agree, and coupling a retention
    // guarantee to an invariant enforced eighty lines away is how it silently stops
    // holding. Compared as epochs, never as strings: an expanded-year ISO form sorts
    // before every digit and would read as "not retained".
    for (const [index, entry] of known.lineages.entries()) {
      if (!plan.objects.some((key) => key.startsWith(`${entry.prefix}/`))) continue;
      const until = retainedUntil(entry.retentionOpenedAt);
      // The finiteness half is unreachable while `readLineages` validates every
      // `retentionOpenedAt`, and is kept because its absence fails OPEN: an unusable
      // retention would otherwise compare as elapsed and permit the prune.
      if (!Number.isFinite(until) || until > observedAt) {
        return denied('retained-lineage-prune', `lineages:#${index}`);
      }
    }

    return { ok: true, authority: false, reason: '', detail: '' };
  } catch {
    // A distinct code: a crash must never be readable as a routine prune rejection.
    // Unreachable while every guard above refuses non-data before serialization, so no
    // test can provoke it; it is declared as a backstop rather than claimed as covered.
    return denied('prune-faulted');
  }
}
