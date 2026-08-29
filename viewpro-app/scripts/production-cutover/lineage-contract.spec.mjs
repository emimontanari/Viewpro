import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { validateLineage } from './lineage-contract.mjs';
const contract = JSON.parse(await readFile(new URL('./candidate.v1.json', import.meta.url)));
const ids = [contract.fixedPatches.WU1, contract.fixedPatches.WU2, ...['1', '2', '3', '4', '5'].map((n) => n.repeat(40))];
const candidate = () => ({ prefix: [...contract.prefix], exclusions: [...contract.exclusions], patches: contract.patchOrder.map((workUnit, i) => ({ workUnit, identity: ids[i] })), final: [...contract.prefix, ...ids], closure: [] });
const guarded = (target, calls) => new Proxy(target, { get(...args) { calls.push('get'); return Reflect.get(...args); }, set(...args) { calls.push('set'); return Reflect.set(...args); }, has(...args) { calls.push('has'); return Reflect.has(...args); }, deleteProperty(...args) { calls.push('deleteProperty'); return Reflect.deleteProperty(...args); }, defineProperty(...args) { calls.push('defineProperty'); return Reflect.defineProperty(...args); }, getOwnPropertyDescriptor(...args) { calls.push('getOwnPropertyDescriptor'); return Reflect.getOwnPropertyDescriptor(...args); }, ownKeys(...args) { calls.push('ownKeys'); return Reflect.ownKeys(...args); }, getPrototypeOf(...args) { calls.push('getPrototypeOf'); return Reflect.getPrototypeOf(...args); }, setPrototypeOf(...args) { calls.push('setPrototypeOf'); return Reflect.setPrototypeOf(...args); }, isExtensible(...args) { calls.push('isExtensible'); return Reflect.isExtensible(...args); }, preventExtensions(...args) { calls.push('preventExtensions'); return Reflect.preventExtensions(...args); }, apply(...args) { calls.push('apply'); return Reflect.apply(...args); }, construct(...args) { calls.push('construct'); return Reflect.construct(...args); } });
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
test('rejects transparent root proxies without trap calls', () => {
  const calls = []; assert.deepEqual([validateLineage(guarded(candidate(), calls)), calls], [false, []]);
});
test('rejects stateful nested proxies without trap calls', () => {
  const calls = []; const value = candidate(); value.closure.push(guarded(candidate(), calls)); assert.deepEqual([validateLineage(value), calls], [false, []]); const closureCalls = []; const closure = candidate(); closure.closure = guarded([], closureCalls); assert.deepEqual([validateLineage(closure), closureCalls], [false, []]);
});
test('fails closed without invoking caller-controlled array methods or proxy traps', () => {
  const value = candidate(); let called = false;
  Object.setPrototypeOf(value.patches, { every() { called = true; throw Error(); }, map() { called = true; throw Error(); }, includes() { called = true; throw Error(); } });
  assert.equal(validateLineage(value), false); assert.equal(called, false);
  assert.equal(validateLineage(new Proxy(candidate(), { getPrototypeOf() { throw Error(); } })), false);
  assert.equal(validateLineage(new Proxy(candidate(), { ownKeys() { throw Error(); } })), false);
  const { proxy, revoke } = Proxy.revocable(candidate(), {}); revoke(); assert.equal(validateLineage(proxy), false);
});
