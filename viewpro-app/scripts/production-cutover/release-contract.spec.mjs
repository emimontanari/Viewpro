import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as contract from './release-contract.mjs';
const { releaseAuthority, validateRelease } = contract;
const prefix = ['main@868dc70', '#331', '#333', '#334', '#335', '#336'];
const ids = ['faf870ab0a29e6a271b7391776fc2f9cf25c12ac', 'd53a57c04f34efd20fc825aff5c03115c9c6c99f', ...['1', '2', '3', '4', '5'].map((n) => n.repeat(40))];
const receipt = 'openspec/changes/neon-clean-production-cutover/apply-progress.md';
const release = () => JSON.stringify({ schemaVersion: 1, kind: 'production-cutover-release-contract', prefix, workUnits: ids.map((identity, index) => ({ workUnit: `WU${index + 1}`, identity })), final: [...prefix, ...ids], closure: [], remediation: { WU1: { reviewedDevelopMerge: ids[0], implementationReceipt: receipt }, WU2: { reviewedDevelopMerge: ids[1], implementationReceipt: receipt } } });
test('requires the exact Lineage prefix before ordered WU identities', () => {
  assert.equal(validateRelease(release()), true);
  const missing = JSON.parse(release()); missing.final = [...ids];
  const altered = JSON.parse(release()); altered.prefix[0] = 'main@0000000';
  assert.equal(validateRelease(JSON.stringify(missing)), false);
  assert.equal(validateRelease(JSON.stringify(altered)), false);
});
test('requires the same prefixed final in every closure', () => {
  const root = JSON.parse(release()); root.closure = [JSON.parse(release())];
  assert.equal(validateRelease(JSON.stringify(root)), true);
  root.closure[0].final[0] = '#331';
  assert.equal(validateRelease(JSON.stringify(root)), false);
});
test('rejects malformed, duplicate, reordered, retargeted, unknown, and authority input', () => {
  const altered = JSON.parse(release());
  const cases = ['{', release().replace('"final":', '"final":[],"final":'), JSON.stringify({ ...altered, extra: true }), JSON.stringify({ ...altered, authority: 'final' })];
  altered.workUnits.reverse(); cases.push(JSON.stringify(altered));
  altered.workUnits.reverse(); altered.workUnits[0].identity = 'f'.repeat(40); altered.final[6] = 'f'.repeat(40); cases.push(JSON.stringify(altered));
  for (const value of cases) assert.equal(validateRelease(value), false);
});
test('rejects transparent and revoked root and nested proxies before reflection', () => {
  const root = JSON.parse(release());
  assert.equal(contract.validateReleaseRecord(new Proxy(root, {})), false);
  root.closure = [new Proxy(JSON.parse(release()), {})];
  assert.equal(contract.validateReleaseRecord(root), false);
  const revokedRoot = Proxy.revocable(JSON.parse(release()), {}); revokedRoot.revoke();
  assert.equal(contract.validateReleaseRecord(revokedRoot.proxy), false);
  const revokedChild = Proxy.revocable(JSON.parse(release()), {}); revokedChild.revoke();
  root.closure = [revokedChild.proxy];
  assert.equal(contract.validateReleaseRecord(root), false);
});
test('uses captured parse, regex, and array comparison intrinsics', () => {
  const parse = JSON.parse; const regexTest = RegExp.prototype.test; const every = Array.prototype.every;
  try {
    JSON.parse = () => { throw new Error('poisoned'); };
    RegExp.prototype.test = () => false;
    Array.prototype.every = () => true;
    assert.equal(validateRelease(release()), true);
  } finally { JSON.parse = parse; RegExp.prototype.test = regexTest; Array.prototype.every = every; }
});
test('keeps an unpopulated external-only template and denies operational authority', async () => {
  const template = JSON.parse(await readFile(new URL('./release-manifest.v1.template.json', import.meta.url)));
  const schema = JSON.parse(await readFile(new URL('./release-manifest.v1.schema.json', import.meta.url)));
  assert.deepEqual([template.status, template.authority, template.prefix, template.workUnits.length, schema.additionalProperties], ['unpopulated-template', 'external-only', null, 0, false]);
  for (const area of ['repository', 'Git', 'process', 'network', 'provider', 'deployment', 'promotion', 'traffic', 'release', 'final-WU3']) assert.equal(releaseAuthority(area), false);
  assert.equal(validateRelease(JSON.stringify(template)), false);
});
