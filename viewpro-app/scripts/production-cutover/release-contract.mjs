import { types } from 'node:util';
const prefix = ['main@868dc70', '#331', '#333', '#334', '#335', '#336'];
const units = ['WU1', 'WU2', 'WU3', 'WU4', 'WU5', 'WU6', 'WU7'];
const fixed = ['faf870ab0a29e6a271b7391776fc2f9cf25c12ac', 'd53a57c04f34efd20fc825aff5c03115c9c6c99f'];
const receipt = 'openspec/changes/neon-clean-production-cutover/apply-progress.md';
const rootFields = ['schemaVersion', 'kind', 'prefix', 'workUnits', 'final', 'closure', 'remediation'];
const hash = /^[a-f0-9]{40}$/;
const authority = ['__proto__', 'constructor', 'prototype'];
const hasOwn = Object.hasOwn;
const getPrototype = Object.getPrototypeOf;
const ownKeys = Reflect.ownKeys;
const isArray = Array.isArray;
const parse = JSON.parse;
const isProxy = types.isProxy;
const test = Function.call.bind(RegExp.prototype.test);
const includes = Function.call.bind(Array.prototype.includes);
const indexOf = Function.call.bind(Array.prototype.indexOf);
const setHas = Function.call.bind(Set.prototype.has);
const setAdd = Function.call.bind(Set.prototype.add);
const SafeSet = Set;
export const releaseDenials = Object.freeze(['repository', 'Git', 'process', 'network', 'provider', 'deployment', 'promotion', 'traffic', 'release', 'final-WU3']);
function record(value, expected) {
  if (!value || typeof value !== 'object' || isProxy(value)) return false;
  if (getPrototype(value) !== Object.prototype) return false;
  const keys = ownKeys(value);
  if (keys.length !== expected.length) return false;
  for (const key of expected) if (!hasOwn(value, key)) return false;
  for (const key of keys) if (typeof key !== 'string' || includes(authority, key) || !includes(expected, key)) return false;
  return true;
}
function dense(value, expected) {
  if (isProxy(value) || !isArray(value) || getPrototype(value) !== Array.prototype) return false;
  const length = expected ?? value.length;
  if (value.length !== length || ownKeys(value).length !== length + 1) return false;
  for (let index = 0; index < length; index++) if (!hasOwn(value, String(index))) return false;
  return true;
}
function exact(value, expected) {
  if (!dense(value, expected.length)) return false;
  for (let index = 0; index < expected.length; index++) if (value[index] !== expected[index]) return false;
  return true;
}
function noDuplicateKeys(text) {
  let index = 0; let invalid = false;
  const whitespace = () => { while (' \n\r\t'.includes(text[index])) index++; };
  const quoted = () => {
    const start = index++;
    while (index < text.length && text[index] !== '"') index += text[index++] === '\\' ? 2 : 1;
    if (text[index++] !== '"') invalid = true;
    return text.slice(start, index);
  };
  const value = () => {
    whitespace();
    if (text[index] === '{') {
      index++; const keys = new SafeSet(); whitespace();
      while (text[index] !== '}' && !invalid) {
        if (text[index] !== '"') return invalid = true;
        const key = parse(quoted());
        if (setHas(keys, key)) invalid = true;
        setAdd(keys, key); whitespace();
        if (text[index++] !== ':') return invalid = true;
        value(); whitespace();
        if (text[index] === ',') { index++; whitespace(); } else break;
      }
      if (text[index++] !== '}') invalid = true;
    } else if (text[index] === '[') {
      index++; whitespace();
      while (text[index] !== ']' && !invalid) {
        value(); whitespace();
        if (text[index] === ',') { index++; whitespace(); } else break;
      }
      if (text[index++] !== ']') invalid = true;
    } else if (text[index] === '"') quoted();
    else {
      const start = index;
      while (index < text.length && !' \n\r\t,}]'.includes(text[index])) index++;
      if (start === index) invalid = true;
    }
  };
  try { value(); whitespace(); return !invalid && index === text.length; } catch { return false; }
}
function closed(value, expected, seen) {
  if (!record(value, rootFields) || setHas(seen, value)) return false;
  setAdd(seen, value);
  if (value.schemaVersion !== 1 || value.kind !== 'production-cutover-release-contract' || !exact(value.prefix, prefix) || !dense(value.workUnits, units.length)) return false;
  const identities = [];
  for (let index = 0; index < units.length; index++) {
    const workUnit = value.workUnits[index];
    if (!record(workUnit, ['workUnit', 'identity']) || workUnit.workUnit !== units[index] || typeof workUnit.identity !== 'string' || !test(hash, workUnit.identity) || (index < fixed.length && workUnit.identity !== fixed[index]) || (expected && workUnit.identity !== expected[index]) || indexOf(identities, workUnit.identity) !== -1) return false;
    identities.push(workUnit.identity);
  }
  if (!dense(value.final, prefix.length + identities.length) || !exact(value.prefix, prefix) || !record(value.remediation, ['WU1', 'WU2'])) return false;
  for (let index = 0; index < prefix.length; index++) if (value.final[index] !== prefix[index]) return false;
  for (let index = 0; index < identities.length; index++) if (value.final[prefix.length + index] !== identities[index]) return false;
  for (let index = 0; index < fixed.length; index++) {
    const item = value.remediation[units[index]];
    if (!record(item, ['reviewedDevelopMerge', 'implementationReceipt']) || item.reviewedDevelopMerge !== fixed[index] || item.implementationReceipt !== receipt) return false;
  }
  if (!dense(value.closure)) return false;
  for (let index = 0; index < value.closure.length; index++) if (!closed(value.closure[index], identities, seen)) return false;
  return true;
}
export function validateReleaseRecord(value) {
  try { return closed(value, null, new SafeSet()); } catch { return false; }
}
export function validateRelease(text) {
  if (typeof text !== 'string' || !noDuplicateKeys(text)) return false;
  try { return validateReleaseRecord(parse(text)); } catch { return false; }
}
export const releaseAuthority = () => false;
