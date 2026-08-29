import { types } from 'node:util';

// Duplicated verbatim in receipt.mjs: this work unit's allowed-path list admits no shared
// module. Any change to the shared predicates must be mirrored there.

// The non-atomic activation sequence, in the only order it may be performed.
export const activationSteps = Object.freeze([
  'freeze-writes',
  'provision-roles',
  'stage-image',
  'stage-inactive-url',
  'rotate-access',
  'activate-product',
  'activate-platform',
  'deploy-frontends',
  'bind-backups',
  'checkpoint-resume',
]);

// Only `complete` is progress. The rest exist so an unfinished step is named rather than
// silently read as done, which is what turns a half-applied activation into a hidden one.
export const stepStates = Object.freeze(['complete', 'partial', 'unknown', 'absent']);

// Exported so a caller can assert non-authority without constructing a checkpoint.
export const checkpointAuthority = () => false;

// A checkpoint is validated as a data-only snapshot, never as the caller's live object:
// an accessor otherwise lets validation and the later read disagree, which would report a
// half-applied activation as complete.
const snapshot = (value) => JSON.parse(JSON.stringify(value));

const members = Object.freeze([
  'schemaVersion',
  'kind',
  'generation',
  'freeze',
  'isolation',
  'steps',
]);

const containment = Object.freeze(['freeze', 'isolation']);
const authorityKeys = new Set(['__proto__', 'constructor', 'prototype']);

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
  return keys.every((key) => typeof key === 'string' && !authorityKeys.has(key) && names.includes(key));
};

const denied = (reason, detail = '') => ({ ok: false, authority: false, reason, detail });

export function validateCheckpoint(live, { generation } = {}) {
  try {
    if (!plain(live)) return denied('not-a-checkpoint');
    let value;
    try {
      value = snapshot(live);
    } catch {
      return denied('not-a-checkpoint');
    }
    if (!closedRecord(value, members)) return denied('member-set-mismatch');
    if (value.schemaVersion !== 1) return denied('schema-rejected');
    if (value.kind !== 'production-cutover-checkpoint') return denied('kind-rejected');
    if (!Number.isSafeInteger(generation) || value.generation !== generation) {
      return denied('generation-mismatch');
    }
    for (const member of containment) {
      if (!['held', 'lapsed'].includes(value[member])) return denied('containment-rejected', member);
    }

    // Progress past the end of the sequence needs no separate guard: the position check
    // below finds no step to match and rejects it.
    if (!denseArray(value.steps)) return denied('sequence-rejected');

    for (const [index, entry] of value.steps.entries()) {
      if (!closedRecord(entry, ['step', 'state'])) return denied('sequence-rejected', String(index));
      // Position is the contract: a step recorded anywhere but its own slot means the
      // sequence was skipped, repeated or reordered.
      if (entry.step !== activationSteps[index]) return denied('sequence-rejected', String(index));
      if (!stepStates.includes(entry.state)) return denied('state-rejected', activationSteps[index]);
      if (entry.state !== 'complete') return denied('incomplete-step', activationSteps[index]);
    }

    return { ok: true, authority: false, reason: '', detail: '', steps: value.steps.length };
  } catch {
    // No caller value ever reaches the detail, including through a thrown object.
    return denied('checkpoint-rejected');
  }
}

export function resumePoint(live, { generation } = {}) {
  try {
    const validated = validateCheckpoint(live, { generation });
    if (!validated.ok) return { ...validated, next: '', complete: false };

    // Read from the snapshot validation already accepted, never from `live` again: a
    // re-read is a window in which the answer can change under us.
    const value = snapshot(live);
    const done = validated.steps;
    // `complete` reports what the steps proved, independent of whether resuming is
    // permitted, so a caller cannot be told an finished activation is unfinished.
    const complete = done === activationSteps.length;

    // Resuming is only safe while the containment established earlier still holds.
    for (const member of containment) {
      if (value[member] !== 'held') {
        return { ...denied('containment-lapsed', member), next: '', complete };
      }
    }

    return {
      ok: true,
      authority: false,
      reason: '',
      detail: '',
      next: complete ? '' : activationSteps[done],
      complete,
    };
  } catch {
    return { ...denied('checkpoint-rejected'), next: '', complete: false };
  }
}
