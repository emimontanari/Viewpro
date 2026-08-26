import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { types } from 'node:util';

// Duplicated verbatim in checkpoint.mjs: this work unit's allowed-path list admits no
// shared module. Any change to the shared predicates must be mirrored there.

// What a public receipt never carries and never grants.
export const receiptDenials = Object.freeze([
  'secret',
  'host',
  'role',
  'project',
  'provider',
  'network',
  'repository',
  'Git',
  'process',
  'deployment',
  'promotion',
  'traffic',
  'release',
]);

export const receiptStates = Object.freeze(['staged', 'activated', 'closed']);

// Exported so a caller can assert non-authority without constructing a receipt.
export const receiptAuthority = () => false;

const members = Object.freeze([
  'schemaVersion',
  'kind',
  'generation',
  'state',
  'digest',
  'versions',
  'aliases',
  'base',
  'patches',
  'tree',
  'pathDigests',
  'imageDigests',
  'deployment',
  'secrets',
  'backup',
  'evidence',
  'timestamps',
]);

// Members whose own rule already forbids free text. Everything else is content scanned,
// so a member added to `members` defaults to scanned rather than silently exempt.
const structurallyBound = Object.freeze([
  'schemaVersion',
  'kind',
  'generation',
  'state',
  'digest',
]);
const contentScanned = Object.freeze(members.filter((name) => !structurallyBound.includes(name)));

const authorityKeys = new Set(['__proto__', 'constructor', 'prototype']);
const identityForm = /^[a-f0-9]{40}$/;
const digestForm = /^sha256:[a-f0-9]{64}$/;
const hmacForm = /^[a-f0-9]{64}$/;
const instantForm = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const anyIdentityForm = /^(sha256:)?[a-f0-9]{64}$/i;
const loneSurrogate = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const maxDepth = 64;

// Shapes recoverable to a real host, credential, role or provider object even when they
// look inert. Tested against member NAMES as well as values: a member name is operator
// chosen free text, so it leaks just as readily as a value.
const rawShapes = Object.freeze([
  /-----BEGIN /,
  /[a-z][a-z0-9+.-]*:\/\//i,
  // A dotted name whose final label is alphabetic: a host, never a semantic version.
  /\b(?=[a-z0-9-]*[a-z])[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}\b/i,
  /proj_/i,
  /\bbr-[a-z]+-[a-z]+-[a-z0-9]+\b/i,
  /[a-z0-9]_owner\b/i,
  /\b(sk|pk|rk)_(live|test)_[a-z0-9]+/i,
  /AKIA[0-9A-Z]{8,}/,
  /npg_[a-z0-9]+/i,
  /\b\d{1,3}(\.\d{1,3}){3}\b/,
]);

const plain = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !types.isProxy(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));

const denseArray = (value) =>
  Array.isArray(value) &&
  !types.isProxy(value) &&
  Object.getPrototypeOf(value) === Array.prototype &&
  Reflect.ownKeys(value).length === value.length + 1;

const closedRecord = (value, names) => {
  if (!plain(value)) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== names.length) return false;
  return keys.every(
    (key) => typeof key === 'string' && !authorityKeys.has(key) && names.includes(key),
  );
};

// RFC 8785: members ordered by UTF-16 code units, no insignificant whitespace, and only
// the escapes JSON already produces. Anything lossy fails closed instead of serializing.
const serialize = (value, seen, depth) => {
  if (depth > maxDepth) throw new TypeError('too deep');
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('non-finite number');
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    if (loneSurrogate.test(value)) throw new TypeError('lone surrogate');
    return JSON.stringify(value);
  }
  if (typeof value !== 'object') throw new TypeError(`unserializable ${typeof value}`);
  if (seen.has(value)) throw new TypeError('cycle');
  seen.add(value);
  try {
    if (denseArray(value)) {
      return `[${value.map((entry) => serialize(entry, seen, depth + 1)).join(',')}]`;
    }
    if (!plain(value)) throw new TypeError('not a plain object');
    const pairs = Object.keys(value)
      .sort()
      .map((key) => {
        if (loneSurrogate.test(key)) throw new TypeError('lone surrogate in member name');
        return `${JSON.stringify(key)}:${serialize(value[key], seen, depth + 1)}`;
      });
    return `{${pairs.join(',')}}`;
  } finally {
    // Path scoped, not global: the same object reached twice down different branches is a
    // DAG and serializes fine, matching JSON semantics. Only an ancestor repeating itself
    // is a cycle. A global set here would reject legitimate shared references.
    seen.delete(value);
  }
};

// Producer-side entry points (`canonicalize`, `receiptDigest`, `redact`) THROW, because
// bad input there is a programmer error. Verifier-side entry points (`validateReceipt`)
// DENY, because bad input there is the expected case. Producer throws are always
// TypeError, including for depth, so a caller can branch on the class.
export function canonicalize(value) {
  return serialize(value, new Set(), 0);
}

export function receiptDigest(value) {
  const bytes = Buffer.from(canonicalize(value), 'utf8');
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

// Correlates a private identifier without revealing it. The key version is length
// prefixed rather than space separated, so `redact('a b', 'v')` cannot collide with
// `redact('b', 'v a')`. A plain digest of a low-entropy identifier such as a hostname is
// recoverable by enumeration, so the correlation is keyed; the key is a rotation-scoped
// secret rather than a salt, which is why it carries an entropy floor.
export function redact(value, { keyVersion, key } = {}) {
  if (typeof value !== 'string' || value === '') throw new TypeError('nothing to redact');
  if (typeof keyVersion !== 'string' || keyVersion === '') throw new TypeError('unnamed key version');
  if (!Buffer.isBuffer(key)) throw new TypeError('missing key');
  if (key.length < 32) throw new TypeError('key below the 32 byte floor');
  const message = `${keyVersion.length}:${keyVersion}${value}`;
  return { keyVersion, hmac: createHmac('sha256', key).update(message).digest('hex') };
}

const isReference = (value) =>
  closedRecord(value, ['keyVersion', 'hmac']) &&
  typeof value.keyVersion === 'string' &&
  value.keyVersion !== '' &&
  typeof value.hmac === 'string' &&
  hmacForm.test(value.hmac);

// Scans member names as well as values. `seen` keeps a cyclic member from exhausting the
// stack here, before `serialize` can report the precise reason.
const carriesRawShape = (value, seen = new Set()) => {
  if (typeof value === 'string') return rawShapes.some((shape) => shape.test(value));
  if (value === null || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((entry) => carriesRawShape(entry, seen));
  return Object.entries(value).some(
    ([name, entry]) => rawShapes.some((shape) => shape.test(name)) || carriesRawShape(entry, seen),
  );
};

// Details name the offending MEMBER, never its value: a denial is public evidence too, so
// echoing the value would leak exactly what redaction exists to withhold.
const denied = (reason, detail = '') => ({ ok: false, authority: false, reason, detail });

const referencesOnly = (value) => plain(value) && Object.values(value).every(isReference);
const valuesMatch = (value, form) =>
  plain(value) && Object.values(value).every((entry) => typeof entry === 'string' && form.test(entry));

export function validateReceipt(value, { generation } = {}) {
  try {
    if (!plain(value)) return denied('not-a-receipt');

    // Validate a canonical data-only snapshot, never the caller's live object. Accessors
    // and own non-enumerable members otherwise let the validated view and the digested
    // view disagree, which is a forged identity rather than a rejected receipt.
    let receipt;
    try {
      receipt = JSON.parse(canonicalize(value));
    } catch {
      return denied('not-canonicalizable');
    }

    // --- Shape and identity -------------------------------------------------------
    if (!closedRecord(receipt, members)) return denied('member-set-mismatch');
    if (receipt.schemaVersion !== 1) return denied('schema-rejected');
    if (receipt.kind !== 'production-cutover-receipt') return denied('kind-rejected');
    if (!Number.isSafeInteger(generation) || generation < 0) return denied('generation-mismatch');
    if (receipt.generation !== generation) return denied('generation-mismatch');
    if (!receiptStates.includes(receipt.state)) return denied('state-rejected', 'state');

    // --- Redaction boundary -------------------------------------------------------
    if (!referencesOnly(receipt.deployment)) return denied('unredacted-content', 'deployment');
    if (!denseArray(receipt.secrets) || !receipt.secrets.every(isReference)) {
      return denied('unredacted-content', 'secrets');
    }
    if (!closedRecord(receipt.backup, ['lineage', 'heartbeat'])) {
      return denied('unredacted-content', 'backup');
    }
    if (!isReference(receipt.backup.lineage) || !instantForm.test(receipt.backup.heartbeat)) {
      return denied('unredacted-content', 'backup');
    }
    if (!valuesMatch(receipt.evidence, digestForm)) return denied('unredacted-content', 'evidence');
    // Every member without its own rule, plus the key versions the rules above admit.
    for (const member of contentScanned) {
      if (carriesRawShape(receipt[member])) return denied('unredacted-content', member);
    }

    // --- Structural form ----------------------------------------------------------
    if (!identityForm.test(receipt.base)) return denied('base-rejected', 'base');
    if (!identityForm.test(receipt.tree)) return denied('tree-rejected', 'tree');
    if (!denseArray(receipt.patches) || !receipt.patches.every((entry) => identityForm.test(entry))) {
      return denied('patches-rejected', 'patches');
    }
    if (!denseArray(receipt.aliases) || !receipt.aliases.every((entry) => typeof entry === 'string')) {
      return denied('aliases-rejected', 'aliases');
    }
    if (!valuesMatch(receipt.versions, /^.+$/)) return denied('versions-rejected', 'versions');
    if (!valuesMatch(receipt.pathDigests, identityForm)) {
      return denied('path-digests-rejected', 'pathDigests');
    }
    if (!valuesMatch(receipt.imageDigests, digestForm)) {
      return denied('image-digests-rejected', 'imageDigests');
    }
    if (!valuesMatch(receipt.timestamps, instantForm)) {
      return denied('timestamps-rejected', 'timestamps');
    }

    // --- Digest -------------------------------------------------------------------
    if (!digestForm.test(receipt.digest)) return denied('digest-mismatch', 'digest');

    // Checked on its own terms, before the digest is recomputed: an alias that restates
    // any receipt identity is refused whether or not this receipt's digest still matches.
    // A public alias is pinned and non-authoritative, so it never carries identity.
    if (receipt.aliases.some((alias) => anyIdentityForm.test(alias.trim()))) {
      return denied('alias-shadows-identity', 'aliases');
    }

    const recomputed = Buffer.from(receiptDigest({ ...receipt, digest: '' }));
    const recorded = Buffer.from(receipt.digest);
    if (recomputed.length !== recorded.length || !timingSafeEqual(recomputed, recorded)) {
      return denied('digest-mismatch', 'digest');
    }

    return { ok: true, authority: false, reason: '', detail: '' };
  } catch {
    // No caller value ever reaches the detail, including through a thrown object.
    return denied('receipt-rejected');
  }
}
