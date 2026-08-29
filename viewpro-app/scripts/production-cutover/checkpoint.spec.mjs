import assert from 'node:assert/strict';
import test from 'node:test';

import {
  activationSteps,
  checkpointAuthority,
  resumePoint,
  stepStates,
  validateCheckpoint,
} from './checkpoint.mjs';

const generation = 4;

const complete = (count) =>
  activationSteps.slice(0, count).map((step) => ({ step, state: 'complete' }));

// A checkpoint five steps into the ordered activation sequence, freeze and isolation held.
const checkpoint = (count = 5) => ({
  schemaVersion: 1,
  kind: 'production-cutover-checkpoint',
  generation,
  freeze: 'held',
  isolation: 'held',
  steps: complete(count),
});

test('publishes the activation sequence as an ordered frozen list', () => {
  assert.ok(Object.isFrozen(activationSteps));
  assert.ok(Object.isFrozen(stepStates));
  // Pinned literally, independent of the module: every fixture here slices
  // `activationSteps` and the validator compares against `activationSteps`, so any
  // permutation of it would be self-consistent and invisible to every other test.
  assert.deepEqual(
    [...activationSteps],
    [
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
    ],
  );
  assert.equal(new Set(activationSteps).size, activationSteps.length);
  // Only a completed step may ever be recorded as progress.
  assert.deepEqual([...stepStates], ['complete', 'partial', 'unknown', 'absent']);
});

test('accepts an ordered checkpoint whose steps are all complete', () => {
  const result = validateCheckpoint(checkpoint(), { generation });
  assert.equal(result.reason, '', result.detail);
  assert.equal(result.ok, true);
  assert.equal(result.authority, false);
});

test('resumes at the next step rather than restarting', () => {
  for (const count of [0, 1, 5, 9]) {
    const result = resumePoint(checkpoint(count), { generation });
    assert.equal(result.reason, '', result.detail);
    assert.equal(result.ok, true);
    assert.equal(result.next, activationSteps[count], `must resume at step ${count}`);
    assert.equal(result.authority, false);
  }
});

test('reports completion when every step is done, and never a step to redo', () => {
  const result = resumePoint(checkpoint(activationSteps.length), { generation });
  assert.equal(result.ok, true);
  assert.equal(result.next, '');
  assert.equal(result.complete, true);
});

test('fails closed when the latest step is partial, unknown or absent (RED-CUT-06)', () => {
  for (const state of ['partial', 'unknown', 'absent']) {
    const value = checkpoint();
    value.steps[4] = { step: activationSteps[4], state };
    const validated = validateCheckpoint(value, { generation });
    assert.equal(validated.ok, false, `${state} must be rejected`);
    assert.equal(validated.reason, 'incomplete-step');
    assert.equal(validated.detail, activationSteps[4]);

    const resumed = resumePoint(value, { generation });
    assert.equal(resumed.ok, false, `${state} must not yield a resume point`);
    assert.equal(resumed.reason, 'incomplete-step');
    assert.equal(resumed.detail, activationSteps[4]);
    assert.equal(resumed.next, '');
    assert.equal(resumed.authority, false);
  }
});

test('fails closed on an unknown step state rather than assuming progress', () => {
  const value = checkpoint();
  value.steps[2] = { step: activationSteps[2], state: 'probably-fine' };
  const result = resumePoint(value, { generation });
  assert.equal(result.reason, 'state-rejected');
  assert.equal(result.ok, false);
});

test('rejects skipped, repeated or reordered progress', () => {
  const skipped = checkpoint();
  skipped.steps[3] = { step: activationSteps[7], state: 'complete' };
  const repeated = checkpoint();
  repeated.steps[3] = { step: activationSteps[2], state: 'complete' };
  const reordered = checkpoint();
  [reordered.steps[1], reordered.steps[2]] = [reordered.steps[2], reordered.steps[1]];
  const overrun = checkpoint();
  overrun.steps = [...complete(activationSteps.length), { step: activationSteps[0], state: 'complete' }];

  for (const [label, value] of [
    ['a skipped step', skipped],
    ['a repeated step', repeated],
    ['a reordered pair', reordered],
    ['progress past the sequence', overrun],
  ]) {
    const result = validateCheckpoint(value, { generation });
    assert.equal(result.reason, 'sequence-rejected', label);
    assert.equal(result.authority, false, label);
    assert.equal(resumePoint(value, { generation }).ok, false, label);
  }
});

test('refuses to resume once freeze or isolation has lapsed', () => {
  for (const member of ['freeze', 'isolation']) {
    const value = checkpoint();
    value[member] = 'lapsed';
    const result = resumePoint(value, { generation });
    assert.equal(result.reason, 'containment-lapsed');
    assert.equal(result.detail, member);
    assert.equal(result.ok, false);
    assert.equal(result.next, '');
  }
});

test('rejects a wrong generation', () => {
  const result = validateCheckpoint(checkpoint(), { generation: generation + 1 });
  assert.equal(result.reason, 'generation-mismatch');
  assert.equal(result.ok, false);
});

test('rejects an unknown, missing, authority-keyed or hostile shape', () => {
  const unknown = checkpoint();
  unknown.extra = 1;
  const missing = checkpoint();
  delete missing.isolation;
  const authority = checkpoint();
  Object.defineProperty(authority, 'constructor', { value: 1, enumerable: true });
  const sparse = checkpoint();
  sparse.steps = Object.assign([], { 0: { step: activationSteps[0], state: 'complete' }, length: 3 });
  const stepShape = checkpoint();
  stepShape.steps[1] = { step: activationSteps[1], state: 'complete', extra: true };

  for (const [label, value, reason] of [
    ['an unknown member', unknown, 'member-set-mismatch'],
    ['a missing member', missing, 'member-set-mismatch'],
    ['an authority key', authority, 'member-set-mismatch'],
    ['a sparse steps array', sparse, 'sequence-rejected'],
    ['an open step record', stepShape, 'sequence-rejected'],
  ]) {
    const result = validateCheckpoint(value, { generation });
    assert.equal(result.reason, reason, label);
    assert.equal(result.authority, false, label);
  }
  assert.equal(validateCheckpoint(null, { generation }).reason, 'not-a-checkpoint');
  assert.equal(validateCheckpoint(new Proxy(checkpoint(), {}), { generation }).ok, false);
  assert.equal(resumePoint(null, { generation }).ok, false);
});

test('denies authority on every path', () => {
  assert.equal(checkpointAuthority(), false);
  assert.equal(validateCheckpoint(checkpoint(), { generation }).authority, false);
  assert.equal(resumePoint(checkpoint(), { generation }).authority, false);
  assert.equal(resumePoint({}, { generation }).authority, false);
});

test('rejects a wrong schema version or a foreign kind', () => {
  for (const [member, value, reason] of [
    ['schemaVersion', 2, 'schema-rejected'],
    ['kind', 'production-cutover-receipt', 'kind-rejected'],
  ]) {
    const candidate = checkpoint();
    candidate[member] = value;
    assert.equal(validateCheckpoint(candidate, { generation }).reason, reason);
  }
});

test('rejects containment that is neither held nor lapsed', () => {
  for (const member of ['freeze', 'isolation']) {
    const candidate = checkpoint();
    candidate[member] = 'maybe';
    const result = validateCheckpoint(candidate, { generation });
    assert.equal(result.reason, 'containment-rejected');
    assert.equal(result.detail, member);
  }
});

test('contains an exception rather than letting it escape', () => {
  const throwing = checkpoint();
  Object.defineProperty(throwing, 'steps', {
    enumerable: true,
    get() {
      throw new Error('provider read failed');
    },
  });
  // Both entry points must deny, and neither may surface the thrown value.
  for (const result of [
    validateCheckpoint(throwing, { generation }),
    resumePoint(throwing, { generation }),
  ]) {
    assert.equal(result.ok, false);
    assert.equal(result.authority, false);
    assert.doesNotMatch(JSON.stringify(result), /provider read failed/);
  }
});

test('never resumes from a view that changed after validation', () => {
  // A member answering differently on each read would otherwise let a checkpoint
  // validated at three steps report the activation complete at ten.
  let reads = 0;
  const shifting = checkpoint(3);
  const short = complete(3);
  const long = complete(activationSteps.length);
  Object.defineProperty(shifting, 'steps', {
    enumerable: true,
    get() {
      reads += 1;
      return reads === 1 ? short : long;
    },
  });
  const result = resumePoint(shifting, { generation });
  assert.notEqual(result.complete, true, 'a three-step checkpoint is never complete');
  if (result.ok) assert.equal(result.next, activationSteps[3]);
});

test('reports completion honestly even when resuming is refused', () => {
  const finished = checkpoint(activationSteps.length);
  finished.isolation = 'lapsed';
  const result = resumePoint(finished, { generation });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'containment-lapsed');
  assert.equal(result.next, '');
  // The steps were proven complete; only containment lapsed. Saying otherwise would
  // invite a caller to re-run a finished cutover.
  assert.equal(result.complete, true);
});

test('pins complete on every failure path', () => {
  for (const [label, value] of [
    ['null', null],
    ['an empty object', {}],
    ['an incomplete step', (() => {
      const partial = checkpoint();
      partial.steps[4] = { step: activationSteps[4], state: 'partial' };
      return partial;
    })()],
  ]) {
    const result = resumePoint(value, { generation });
    assert.equal(result.ok, false, label);
    assert.equal(result.next, '', label);
    assert.equal(result.complete, false, label);
  }
});
