import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { validateLineage } from './lineage-contract.mjs';
import { releaseAuthority, validateReleaseRecord } from './release-contract.mjs';

// Task 5.2 — the provisional assembly. The artifact beside this suite records which
// reviewed develop merge each work unit resolved to, and states that the merged
// contracts accept it. A document that merely CLAIMS a validation proves nothing, so
// this suite performs the validation the document describes.
//
// Assembling is not closing. Task 5.3 is an independent closure by someone who did not
// build these contracts, and nothing here grants authority to promote anything.

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const assemblyPath = resolve(repoRoot, 'docs/evidence/production-cutover/provisional-assembly.v1.json');
const receipt = 'openspec/changes/neon-clean-production-cutover/apply-progress.md';

const assembly = JSON.parse(await readFile(assemblyPath, 'utf8'));
const identities = assembly.workUnits.map((entry) => entry.identity);
const patches = assembly.workUnits.map(({ workUnit, identity }) => ({ workUnit, identity }));

test('records one identity per work unit, in order and distinct', () => {
  assert.deepEqual(
    assembly.workUnits.map((entry) => entry.workUnit),
    ['WU1', 'WU2', 'WU3', 'WU4', 'WU5', 'WU6', 'WU7'],
  );
  assert.equal(new Set(identities).size, identities.length, 'two work units must not share an identity');
  for (const identity of identities) assert.match(identity, /^[a-f0-9]{40}$/);
});

test('keeps the prefix and the fixed work units it inherited', () => {
  // These predate the change and are pinned by the contracts; the assembly restates
  // them rather than choosing them, so a drift here is a drift from the candidate.
  assert.deepEqual(assembly.prefix, ['main@868dc70', '#331', '#333', '#334', '#335', '#336']);
  assert.deepEqual(assembly.exclusions, ['#338', '#341', '#344', '#351', '#314']);
  assert.equal(identities[0], 'faf870ab0a29e6a271b7391776fc2f9cf25c12ac');
  assert.equal(identities[1], 'd53a57c04f34efd20fc825aff5c03115c9c6c99f');
});

test('names WU3 by the slice at which it became complete', () => {
  // WU3 was delivered in four reviewed slices, and the lineage model carries one
  // identity per work unit, so the aggregate is the last slice to land.
  const wu3 = assembly.workUnits.find((entry) => entry.workUnit === 'WU3');
  assert.ok(Array.isArray(wu3.slices) && wu3.slices.length === 4, 'every slice must be recorded');
  assert.equal(wu3.identity, wu3.slices.at(-1).identity);
  for (const slice of wu3.slices) assert.match(slice.identity, /^[a-f0-9]{40}$/);
});

test('states a final ordering that is exactly the prefix followed by the identities', () => {
  assert.deepEqual(assembly.final, [...assembly.prefix, ...identities]);
});

test('is accepted by the merged lineage contract', () => {
  assert.equal(
    validateLineage({
      prefix: assembly.prefix,
      exclusions: assembly.exclusions,
      patches,
      final: assembly.final,
      closure: assembly.closure,
    }),
    true,
  );
});

test('is accepted by the merged release contract, which still denies authority', () => {
  assert.equal(
    validateReleaseRecord({
      schemaVersion: 1,
      kind: 'production-cutover-release-contract',
      prefix: assembly.prefix,
      workUnits: patches,
      final: assembly.final,
      closure: assembly.closure,
      remediation: {
        WU1: { reviewedDevelopMerge: identities[0], implementationReceipt: receipt },
        WU2: { reviewedDevelopMerge: identities[1], implementationReceipt: receipt },
      },
    }),
    true,
  );
  // Assembling is not closing, and nothing here may read as a promotion.
  assert.equal(releaseAuthority(), false);
  assert.equal(assembly.status, 'provisional');
  assert.equal(assembly.authority, 'none');
});

test('is rejected once any identity drifts', () => {
  // The acceptance above must be a property of these identities, not of the shape.
  for (let index = 0; index < identities.length; index += 1) {
    const drifted = patches.map((patch, at) =>
      at === index ? { ...patch, identity: '0'.repeat(40) } : patch,
    );
    assert.equal(
      validateLineage({
        prefix: assembly.prefix,
        exclusions: assembly.exclusions,
        patches: drifted,
        final: assembly.final,
        closure: assembly.closure,
      }),
      false,
      `a drifted ${patches[index].workUnit} identity must not be accepted`,
    );
  }
});

test('carries identity only, and no deployed instance', () => {
  // "Identity only, never an instance": a commit identity is allowed here; a secret, a
  // host, a project identifier or a connection string is not.
  const text = JSON.stringify(assembly);
  for (const shape of [
    /postgres:\/\//i,
    /\bnpg_[a-z0-9]/i,
    /\bproj_[a-z0-9]/i,
    /\.neon\.tech/i,
    /\b(sk|pk)_(live|test)_/i,
    /-----BEGIN /,
    /[a-z0-9]_owner\b/i,
  ]) {
    assert.doesNotMatch(text, shape, `the assembly must carry no ${shape}`);
  }
});

test('records the gaps that remain open rather than implying closure', () => {
  assert.ok(Array.isArray(assembly.openGaps) && assembly.openGaps.length > 0);
  for (const gap of assembly.openGaps) assert.equal(typeof gap, 'string');
});
