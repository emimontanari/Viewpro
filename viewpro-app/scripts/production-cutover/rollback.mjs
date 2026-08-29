import { types } from 'node:util';

// These predicates exist in near-identical form in roles.mjs, bootstrap.mjs,
// backup-lineage.mjs, checkpoint.mjs and receipt.mjs, and candidate.mjs carries a
// byte-identical `denied`, because this change's
// per-work-unit path lists admit no shared module. This file carries `plain`,
// `closedRecord`, `authorityKeys`, `dataOnly`, `snapshot` and `denied`; checkpoint.mjs
// carries every one except `dataOnly`; receipt.mjs carries neither `dataOnly` nor
// `snapshot`, using the stronger `canonicalize`. A change here must be mirrored into
// whichever siblings carry the same predicate.

// Where the cutover stands relative to the first business write. `unknown` is a state,
// not an absence: a boundary nobody established is not evidence that no write occurred.
export const writeBoundaries = Object.freeze(['before-first-write', 'after-first-write', 'unknown']);

// The only authorities that may licence a reversal once the generations have diverged.
export const reversalAuthorities = Object.freeze(['reconciliation', 'export']);

// Every refusal this module can emit. Exported so a caller — and a test — can assert the
// vocabulary is closed rather than trusting that it is.
export const reversalReasons = Object.freeze([
  'as-of-rejected',
  'not-a-reversal',
  'member-set-mismatch',
  'schema-rejected',
  'kind-rejected',
  'generation-rejected',
  'write-boundary-rejected',
  'containment-rejected',
  'containment-lapsed',
  'write-boundary-unknown',
  'authority-required',
  'reversal-faulted',
]);

// Exported so a caller can assert non-authority without constructing a reversal.
export const rollbackAuthority = () => false;

const reversalMembers = Object.freeze([
  'schemaVersion',
  'kind',
  'generation',
  'writeBoundary',
  'freeze',
  'isolation',
  'authorities',
]);
const authorityMembers = Object.freeze(['kind', 'approvedBy', 'expiresAt', 'generation']);
const containment = Object.freeze(['freeze', 'isolation']);
// Dominated by the name-membership check below, which already refuses any key the
// member list does not name — including these. Retained only for parity with the five
// sibling modules that carry the same predicate; it is not load-bearing here, and no
// test can observe its removal.
const authorityKeys = new Set(['__proto__', 'constructor', 'prototype']);
const instantForm = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
// Ninety days. An authority is a scoped grant for one cutover, not a standing licence.
const maxAuthorityWindowMs = 90 * 24 * 60 * 60 * 1000;

// Epoch milliseconds for a real instant, or NaN. A shaped but impossible date either
// fails to parse or lands on a different day, and either would move an expiry silently.
const epochOf = (value) => {
  if (typeof value !== 'string' || !instantForm.test(value)) return Number.NaN;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return Number.NaN;
  return new Date(parsed).toISOString() === value ? parsed : Number.NaN;
};

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

// Details name a member, never a caller value: a refusal is evidence too, and an
// approver field can carry a connection string as easily as a name.
const denied = (reason, detail = '') => ({ ok: false, authority: false, reason, detail });

// Present, genuinely approved, genuinely unexpired, and bound to the generation it
// licences. Declaring an authority is not holding one, so each part is judged rather
// than assumed from the record's presence. An authority that names no generation is a
// bearer grant good for any reversal, which is not what "authorised" means here.
const licensedBy = (authorities, generation, observedAt) =>
  authorities.some((entry) => {
    if (!closedRecord(entry, authorityMembers)) return false;
    if (!reversalAuthorities.includes(entry.kind)) return false;
    if (entry.generation !== generation) return false;
    if (typeof entry.approvedBy !== 'string' || entry.approvedBy.trim() === '') return false;
    const expiresAt = epochOf(entry.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= observedAt) return false;
    // A ceiling, because "unexpired" is satisfied by an expiry that never arrives.
    return expiresAt - observedAt <= maxAuthorityWindowMs;
  });

export function validateReversal(live, options) {
  try {
    // Read inside the try: destructuring in the parameter list sits outside it, so a
    // null options object would throw past the backstop instead of denying.
    const observedAt = epochOf(options?.asOf);
    if (!Number.isFinite(observedAt)) return denied('as-of-rejected', 'asOf');
    if (!plain(live) || !dataOnly(live)) return denied('not-a-reversal');

    let reversal;
    try {
      reversal = snapshot(live);
    } catch {
      return denied('not-a-reversal');
    }

    // --- Shape ---------------------------------------------------------------------
    if (!closedRecord(reversal, reversalMembers)) return denied('member-set-mismatch');
    if (reversal.schemaVersion !== 1) return denied('schema-rejected', 'schemaVersion');
    if (reversal.kind !== 'production-cutover-reversal') return denied('kind-rejected', 'kind');
    if (!Number.isSafeInteger(reversal.generation) || reversal.generation < 1) {
      return denied('generation-rejected', 'generation');
    }
    if (!writeBoundaries.includes(reversal.writeBoundary)) {
      return denied('write-boundary-rejected', 'writeBoundary');
    }
    for (const member of containment) {
      if (!['held', 'lapsed'].includes(reversal[member])) {
        return denied('containment-rejected', member);
      }
    }
    if (!Array.isArray(reversal.authorities)) return denied('member-set-mismatch', 'authorities');

    // --- Reversal ------------------------------------------------------------------
    // Restoring the previous generation only makes sense while the containment that
    // stopped the world is still in place.
    for (const member of containment) {
      if (reversal[member] !== 'held') return denied('containment-lapsed', member);
    }
    // An unknown boundary is refused rather than credited: nobody established whether a
    // write happened, and reversing on that basis discards whatever it was.
    if (reversal.writeBoundary === 'unknown') {
      return denied('write-boundary-unknown', 'writeBoundary');
    }
    // After the first write the generations have diverged, so reversing the address
    // silently discards what was written unless someone holds authority to reconcile it.
    if (
      reversal.writeBoundary === 'after-first-write' &&
      !licensedBy(reversal.authorities, reversal.generation, observedAt)
    ) {
      return denied('authority-required', 'authorities');
    }

    return { ok: true, authority: false, reason: '', detail: '' };
  } catch {
    // A distinct code: a crash must never be readable as a routine refusal. Unreachable
    // while every guard above refuses non-data before serialization, so it is declared
    // as a backstop rather than claimed as covered.
    return denied('reversal-faulted');
  }
}
