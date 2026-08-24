import { types } from 'node:util';
const prefix = ['main@868dc70', '#331', '#333', '#334', '#335', '#336'];
const exclusions = ['#338', '#341', '#344', '#351', '#314'];
const units = ['WU1', 'WU2', 'WU3', 'WU4', 'WU5', 'WU6', 'WU7'];
const fixed = ['faf870ab0a29e6a271b7391776fc2f9cf25c12ac', 'd53a57c04f34efd20fc825aff5c03115c9c6c99f'];
const closureMetadata = '3212c438f0ef5be886b090478acfba3a38d64102';
const hash = /^[a-f0-9]{40}$/;
const authority = new Set(['__proto__', 'constructor', 'prototype']);
const isProxy = Object.freeze(types.isProxy);
function record(value, names) {
  if (isProxy(value) || !value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== names.length) return false;
  for (const name of names) if (!Object.hasOwn(value, name)) return false;
  for (const key of keys) if (typeof key !== 'string' || authority.has(key) || !names.includes(key)) return false;
  return true;
}
function dense(value, expected) {
  if (isProxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
  const length = expected ?? value.length;
  if (value.length !== length || Reflect.ownKeys(value).length !== length + 1) return false;
  for (let i = 0; i < length; i++) if (!Object.hasOwn(value, String(i))) return false;
  return true;
}
function exact(value, expected) {
  if (!dense(value, expected.length)) return false;
  for (let i = 0; i < expected.length; i++) if (value[i] !== expected[i]) return false;
  return true;
}
function closed(value, expected, seen) {
  if (seen.has(value) || !record(value, ['prefix', 'exclusions', 'patches', 'final', 'closure']) || !exact(value.prefix, prefix) || !exact(value.exclusions, exclusions) || !dense(value.patches, units.length)) return false;
  seen.add(value);
  const identities = [];
  for (let i = 0; i < units.length; i++) {
    const patch = value.patches[i];
    if (!record(patch, ['workUnit', 'identity']) || patch.workUnit !== units[i] || typeof patch.identity !== 'string' || patch.identity === closureMetadata || !hash.test(patch.identity) || (i < fixed.length && patch.identity !== fixed[i]) || (expected && patch.identity !== expected[i])) return false;
    for (let j = 0; j < i; j++) if (patch.identity === identities[j]) return false;
    identities.push(patch.identity);
  }
  const closure = value.closure;
  if (!dense(value.final, prefix.length + identities.length) || !dense(closure)) return false;
  for (let i = 0; i < prefix.length; i++) if (value.final[i] !== prefix[i]) return false;
  for (let i = 0; i < identities.length; i++) if (value.final[prefix.length + i] !== identities[i]) return false;
  for (let i = 0; i < closure.length; i++) if (!closed(closure[i], identities, seen)) return false;
  return true;
}
export function validateLineage(value) {
  try { return closed(value, null, new Set()); } catch { return false; }
}
