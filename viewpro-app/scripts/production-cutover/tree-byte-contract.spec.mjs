import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { validateTreeBytePolicy } from './tree-byte-contract.mjs';

const policy = {
  schemaVersion: 1,
  kind: 'production-cutover-tree-byte-contract',
  default: { mode: '100644', type: 'blob' },
  exceptions: [
    { path: '.githooks/pre-push', mode: '100755', type: 'blob', hash: 'd8016a819c234d99c5e8b627e34e1349695b3a44' },
    { path: 'viewpro-app/apps/app-new/.claude/skills/tanstack-form', mode: '120000', type: 'blob', hash: 'd12d02091264079b6e212b88678e90f9651ec6e7' },
    { path: 'viewpro-app/apps/app-new/.claude/skills/tanstack-query', mode: '120000', type: 'blob', hash: 'a1aae1817a41407e92a0c2038623bdf7c146c4fd' },
  ],
};
const bytes = (value) => new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));
const clone = () => structuredClone(policy);
const rootDuplicate = () => JSON.stringify(policy).replace('"schemaVersion":1', '"schema\\u0056ersion":1,"schemaVersion":1');
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedGetter = (name) => Object.getOwnPropertyDescriptor(typedArrayPrototype, name).get;
const patch = (target, key, descriptor, run) => { const previous = Object.getOwnPropertyDescriptor(target, key); Object.defineProperty(target, key, { configurable: true, ...descriptor }); try { run(); } finally { if (previous) Object.defineProperty(target, key, previous); else delete target[key]; } };

test('accepts the canonical policy, exact file bytes, and does not mutate input', async () => {
  const input = bytes(policy); const before = [...input];
  const file = new Uint8Array(await readFile(new URL('./final-tree.v1.json', import.meta.url)));
  assert.equal(validateTreeBytePolicy(input), true);
  assert.equal(validateTreeBytePolicy(file), true);
  assert.deepEqual([...input], before);
});

test('rejects non-byte envelopes and invalid text bytes', () => {
  const malformed = new Uint8Array([0xc3, 0x28]);
  const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...bytes(policy)]);
  const nul = new Uint8Array([...bytes(policy), 0]);
  const surrogate = bytes('{"schemaVersion":1,"kind":"production-cutover-tree-byte-contract","default":{"mode":"100644","type":"blob"},"exceptions":[],"note":"\\ud800"}');
  for (const input of [null, {}, new Int8Array(), malformed, bom, nul, surrogate, new Proxy(bytes(policy), {})]) assert.equal(validateTreeBytePolicy(input), false);
  if (typeof SharedArrayBuffer === 'function') assert.equal(validateTreeBytePolicy(new Uint8Array(new SharedArrayBuffer(8))), false);
});

test('rejects duplicate JSON members before schema interpretation and closed members', () => {
  const escapedDuplicate = rootDuplicate();
  const nestedDuplicate = JSON.stringify(policy).replace('"mode":"100644"', '"mode":"100644","\\u006dode":"100644"');
  assert.deepEqual(JSON.parse(escapedDuplicate), policy); assert.deepEqual(JSON.parse(nestedDuplicate), policy);
  for (const input of [escapedDuplicate, nestedDuplicate, JSON.stringify({ ...clone(), entries: [] }), JSON.stringify({ ...clone(), constructor: true })]) assert.equal(validateTreeBytePolicy(bytes(input)), false);
});

test('rejects policy drift, path/hash grammar drift, and operational authority', () => {
  for (const mutate of [
    (value) => value.exceptions.reverse(),
    (value) => { value.default.mode = '100755'; },
    (value) => { value.exceptions[0].path = '../.githooks/pre-push'; },
    (value) => { value.exceptions[1].hash = value.exceptions[1].hash.toUpperCase(); },
    (value) => { value.repository = 'forbidden'; },
  ]) { const value = clone(); mutate(value); assert.equal(validateTreeBytePolicy(bytes(value)), false); }
});

test('is deterministic and resists post-initialization caller prototype poisoning', () => {
  const valid = bytes(policy); const invalid = bytes({ ...clone(), traffic: true });
  const decoder = TextDecoder.prototype.decode; const split = String.prototype.split; const every = Array.prototype.every;
  try {
    TextDecoder.prototype.decode = () => JSON.stringify(policy);
    String.prototype.split = () => ['bypass'];
    Array.prototype.every = () => true;
    assert.equal(validateTreeBytePolicy(valid), true);
    assert.equal(validateTreeBytePolicy(invalid), false);
    assert.equal(validateTreeBytePolicy(new Uint8Array([0xc3, 0x28])), false);
  } finally { TextDecoder.prototype.decode = decoder; String.prototype.split = split; Array.prototype.every = every; }
});

test('resists post-initialization Function.prototype.call poisoning for canonical and invalid policy bytes', () => {
  const invalid = bytes('not-policy'); const canonical = bytes(JSON.stringify(policy, null, 2)); const encoded = JSON.stringify(policy);
  patch(Function.prototype, 'call', { value(receiver, ...args) { if (this === TextDecoder.prototype.decode && args[0].length === invalid.length) return encoded; if (this === TextEncoder.prototype.encode && args[0] === encoded) return invalid; return Reflect.apply(this, receiver, args); } }, () => {
    assert.equal(validateTreeBytePolicy(canonical), true); assert.equal(validateTreeBytePolicy(invalid), false);
  });
});

test('uses captured typed-array and collection intrinsics without iterator dispatch', () => {
  const buffer = typedGetter('buffer'); const byteLength = typedGetter('byteLength'); const rewrite = (key, getter) => { const input = bytes(policy); const before = [...input]; patch(input, key, { get() { input[0] = 0; return Reflect.apply(getter, input, []); } }, () => { assert.equal(validateTreeBytePolicy(input), true); assert.deepEqual([...input], before); }); };
  rewrite('buffer', buffer); rewrite('byteLength', byteLength);
  const typedRewrite = (key, getter) => patch(typedArrayPrototype, key, { get() { this[0] = 0; return Reflect.apply(getter, this, []); } }, () => assert.equal(validateTreeBytePolicy(bytes(policy)), true));
  typedRewrite('buffer', buffer); typedRewrite('byteLength', byteLength);
  if (typeof SharedArrayBuffer === 'function') {
    const shared = new Uint8Array(new SharedArrayBuffer(bytes(policy).length)); shared.set(bytes(policy));
    patch(shared, 'buffer', { get() { return new ArrayBuffer(0); } }, () => assert.equal(validateTreeBytePolicy(shared), false));
    patch(SharedArrayBuffer, Symbol.hasInstance, { value: () => false }, () => assert.equal(validateTreeBytePolicy(shared), false));
  }
  const duplicate = rootDuplicate();
  patch(globalThis, 'Set', { value: class { has() { return false; } add() {} } }, () => assert.equal(validateTreeBytePolicy(bytes(duplicate)), false));
  patch(Set.prototype, 'has', { value: () => false }, () => assert.equal(validateTreeBytePolicy(bytes(duplicate)), false));
  patch(Set.prototype, 'add', { value() { return this; } }, () => assert.equal(validateTreeBytePolicy(bytes(duplicate)), false));
  const iterator = Array.prototype[Symbol.iterator];
  patch(Array.prototype, Symbol.iterator, { value() { return Reflect.apply(iterator, [], []); } }, () => { assert.equal(validateTreeBytePolicy(bytes(policy)), true); assert.equal(validateTreeBytePolicy(bytes({ ...clone(), traffic: true })), false); });
});
