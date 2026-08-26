import { types } from 'node:util';

// These predicates exist in near-identical form in bootstrap.mjs, checkpoint.mjs and
// receipt.mjs, because this change's per-work-unit path lists admit no shared module.
// roles.mjs and bootstrap.mjs carry `plain`, `closedRecord`, `authorityKeys`, `snapshot`
// and `denied`; receipt.mjs has no `snapshot` — it uses the stronger `canonicalize`.
// A change here must be mirrored into whichever siblings carry the same predicate.

// Lane roles, never deployed database role names: a denial is evidence, and a deployed
// role name is exactly what must stay out of it.
export const lanePrincipals = Object.freeze(['public', 'migrator', 'runtime', 'backup']);
export const lanes = Object.freeze(['product', 'platform']);

// Exported so a caller can assert non-authority without supplying a catalog.
export const rolesAuthority = () => false;

// The complete grant vocabulary. A grant outside it is unknown rather than excess,
// because judging a privilege this model has never heard of would be a guess.
export const knownGrants = Object.freeze([
  'db:connect',
  'db:create',
  'db:temp',
  'schema:usage',
  'schema:create',
  'table:dml',
  'table:read',
  'sequence:use',
  'sequence:read',
  'superuser',
  'role:create',
  'replication',
]);

// What each principal MUST hold. Missing any of these is a fault: a lane that holds
// nothing is not least privilege, it is unusable, and it must not pass as safe.
export const requiredGrants = Object.freeze({
  public: Object.freeze([]),
  migrator: Object.freeze(['db:connect', 'schema:usage', 'schema:create']),
  runtime: Object.freeze(['db:connect', 'schema:usage', 'table:dml', 'sequence:use']),
  backup: Object.freeze(['db:connect', 'schema:usage', 'table:read', 'sequence:read']),
});

// What each principal MAY additionally hold. Reads accompany writes, so a runtime that
// also holds table and sequence reads is still least privilege; a backup that holds any
// write is not. Exported so a test can assert the whole denied complement rather than a
// hand-written blacklist, which by construction cannot notice this table widening.
export const permittedGrants = Object.freeze({
  public: Object.freeze([]),
  migrator: Object.freeze(['db:create', 'db:temp']),
  runtime: Object.freeze(['table:read', 'sequence:read']),
  backup: Object.freeze([]),
});

// Objects the migrator may own. Ownership carries ALTER and DROP, so an unbounded
// migrator could reshape business tables and disable their row-level security.
export const migrationObjects = Object.freeze(['migration', 'migrationLedger']);

const catalogMembers = Object.freeze([
  'schemaVersion',
  'kind',
  'lane',
  'grants',
  'owners',
  'memberships',
  'exceptions',
]);

const exceptionMembers = Object.freeze(['principal', 'object', 'approvedBy', 'expiresAt']);
const authorityKeys = new Set(['__proto__', 'constructor', 'prototype']);
const instantForm = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// A real instant, not merely a well-shaped one. `9999-99-99T99:99:99.999Z` matches the
// shape and sorts after every real date, so a syntax-only check makes expiry permanent.
const instantOf = (value) => {
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
    // recursion as a non-data member and are refused there. No separate guard is needed,
    // and adding one would read as load-bearing while proving nothing.
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return dataOnly(descriptor?.value, depth + 1);
  });
};

const snapshot = (value) => JSON.parse(JSON.stringify(value));

// Details name a closed-vocabulary token or a position, never a caller-supplied string:
// a denial is public evidence, and a catalog's own names are deployed identities.
const denied = (reason, detail = '') => ({ ok: false, authority: false, reason, detail });

const stringList = (value) =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

// An exception excuses default OWNERSHIP only, and only while genuinely approved and
// genuinely unexpired. A privilege or a membership is never excused: those are chosen,
// not inherited from the provider's default owner.
const excuses = (exceptions, principal, object, asOf) =>
  exceptions.some((exception) => {
    if (exception.principal !== principal || exception.object !== object) return false;
    if (typeof exception.approvedBy !== 'string' || exception.approvedBy.trim() === '') return false;
    const expiresAt = instantOf(exception.expiresAt);
    return Number.isFinite(expiresAt) && expiresAt > asOf;
  });

export function validateCatalog(live, { lane, asOf } = {}) {
  try {
    if (!lanes.includes(lane)) return denied('lane-rejected', 'lane');
    const observedAt = instantOf(asOf);
    if (!Number.isFinite(observedAt)) return denied('as-of-rejected', 'asOf');
    if (!plain(live)) return denied('not-a-catalog');
    if (!dataOnly(live)) return denied('not-a-catalog');

    let catalog;
    try {
      catalog = snapshot(live);
    } catch {
      return denied('not-a-catalog');
    }

    // --- Shape ---------------------------------------------------------------------
    if (!closedRecord(catalog, catalogMembers)) return denied('member-set-mismatch');
    if (catalog.schemaVersion !== 1) return denied('schema-rejected', 'schemaVersion');
    if (catalog.kind !== 'production-cutover-role-catalog') return denied('kind-rejected', 'kind');
    if (catalog.lane !== lane) return denied('lane-mismatch', 'lane');
    if (!closedRecord(catalog.grants, lanePrincipals)) return denied('unknown-principal', 'grants');
    if (!plain(catalog.owners)) return denied('member-set-mismatch', 'owners');
    if (!plain(catalog.memberships)) return denied('member-set-mismatch', 'memberships');
    for (const map of ['owners', 'memberships']) {
      for (const [index, principal] of Object.keys(catalog[map]).entries()) {
        if (!lanePrincipals.includes(principal)) return denied('unknown-principal', `${map}:#${index}`);
        if (!stringList(catalog[map][principal])) return denied('member-set-mismatch', map);
      }
    }
    if (!Array.isArray(catalog.exceptions)) return denied('member-set-mismatch', 'exceptions');
    for (const [index, exception] of catalog.exceptions.entries()) {
      if (!closedRecord(exception, exceptionMembers)) {
        return denied('member-set-mismatch', `exceptions:#${index}`);
      }
      if (!lanePrincipals.includes(exception.principal)) {
        return denied('unknown-principal', `exceptions:#${index}`);
      }
      if (typeof exception.object !== 'string') {
        return denied('member-set-mismatch', `exceptions:#${index}`);
      }
    }

    // --- Privileges ----------------------------------------------------------------
    for (const principal of lanePrincipals) {
      const held = catalog.grants[principal];
      if (!stringList(held)) return denied('member-set-mismatch', principal);
      const allowed = [...requiredGrants[principal], ...permittedGrants[principal]];
      for (const [index, grant] of held.entries()) {
        if (!knownGrants.includes(grant)) return denied('unknown-grant', `${principal}:#${index}`);
        if (!allowed.includes(grant)) return denied('excess-privilege', `${principal}:${grant}`);
      }
      for (const grant of requiredGrants[principal]) {
        if (!held.includes(grant)) return denied('missing-grant', `${principal}:${grant}`);
      }
    }

    // --- Ownership and membership --------------------------------------------------
    for (const [principal, owned] of Object.entries(catalog.owners)) {
      for (const [index, object] of owned.entries()) {
        // The migrator owns migration objects by default; anything wider, and anything
        // owned by another principal, needs a live exception.
        if (principal === 'migrator' && migrationObjects.includes(object)) continue;
        if (!excuses(catalog.exceptions, principal, object, observedAt)) {
          const known = migrationObjects.includes(object);
          return denied('excess-ownership', known ? `${principal}:${object}` : `${principal}:#${index}`);
        }
      }
    }
    for (const [principal, memberOf] of Object.entries(catalog.memberships)) {
      // Membership inherits privilege, so no lane principal is ever a member of another.
      if (memberOf.length > 0) {
        const known = lanePrincipals.includes(memberOf[0]);
        return denied('excess-membership', known ? `${principal}:${memberOf[0]}` : `${principal}:#0`);
      }
    }

    return { ok: true, authority: false, reason: '', detail: '' };
  } catch {
    // No caller value ever reaches the detail, including through a thrown object.
    return denied('catalog-faulted');
  }
}
