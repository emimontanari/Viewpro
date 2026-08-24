import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { validateLineage } from './lineage-contract.mjs';

const contract = JSON.parse(await readFile(new URL('./candidate.v1.json', import.meta.url)));
const ids = [contract.fixedPatches.WU1, contract.fixedPatches.WU2, ...['1', '2', '3', '4', '5'].map((n) => n.repeat(40))];
const candidate = () => ({ prefix: [...contract.prefix], exclusions: [...contract.exclusions], patches: contract.patchOrder.map((workUnit, i) => ({ workUnit, identity: ids[i] })), final: [...contract.prefix, ...ids], closure: [] });

test('rejects closure metadata as a patch identity', () => {
  const value = candidate(); value.patches[2].identity = '3212c438f0ef5be886b090478acfba3a38d64102'; value.final = [...value.prefix, ...value.patches.map((p) => p.identity)];
  assert.equal(validateLineage(value), false);
});

test('does not coerce identity objects through RegExp.test', () => {
  const value = candidate(); let called = false;
  value.patches[2].identity = { toString() { called = true; return 'a'.repeat(40); } }; value.final = [...value.prefix, ...value.patches.map((p) => p.identity)];
  assert.equal(validateLineage(value), false); assert.equal(called, false);
});

test('accepts exact dense recursively closed lineage without mutation', () => {
  const value = candidate();
  value.closure.push(candidate());
  const before = structuredClone(value);
  assert.equal(validateLineage(value, contract), true);
  assert.deepEqual(value, before);
});

test('rejects coherent duplicate and sparse patches or closure entries', () => {
  for (const mutate of [
    (v) => { v.patches[3].identity = v.patches[2].identity; v.final = [...v.prefix, ...v.patches.map((p) => p.identity)]; },
    (v) => { delete v.patches[3]; },
    (v) => { v.closure.length = 2; },
  ]) { const value = candidate(); mutate(value); assert.equal(validateLineage(value), false); }
});

test('rejects retargeting, drift, unknown fields, and unsafe records', () => {
  for (const mutate of [
    (v) => { v.prefix[0] = 'main@0000000'; },
    (v) => { v.exclusions.reverse(); },
    (v) => { v.patches[0].identity = ids[2]; },
    (v) => { v.final = [...v.prefix]; },
    (v) => { const nested = candidate(); nested.patches[2].identity = 'f'.repeat(40); nested.final = [...nested.prefix, ...nested.patches.map((p) => p.identity)]; v.closure.push(nested); },
    (v) => { v.extra = true; },
    (v) => { delete v.prefix; Object.setPrototypeOf(v, { prefix: contract.prefix }); },
    (v) => Object.defineProperty(v, '__proto__', { enumerable: true, value: true }),
    (v) => Object.defineProperty(v, 'constructor', { enumerable: true, value: true }),
    (v) => Object.defineProperty(v, 'prototype', { enumerable: true, value: true }),
  ]) { const value = candidate(); mutate(value); assert.equal(validateLineage(value, { ...contract, prefix: ['main@0000000'] }), false); }
});

test('fails closed without invoking caller-controlled array methods or proxy traps', () => {
  const value = candidate(); let called = false;
  Object.setPrototypeOf(value.patches, { every() { called = true; throw Error(); }, map() { called = true; throw Error(); }, includes() { called = true; throw Error(); } });
  assert.equal(validateLineage(value), false); assert.equal(called, false);
  assert.equal(validateLineage(new Proxy(candidate(), { getPrototypeOf() { throw Error(); } })), false);
  assert.equal(validateLineage(new Proxy(candidate(), { ownKeys() { throw Error(); } })), false);
});
