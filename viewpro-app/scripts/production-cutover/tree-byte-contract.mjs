import { types } from 'node:util';
const U8 = Uint8Array;
const objectPrototype = Object.prototype;
const getPrototypeOf = Object.getPrototypeOf;
const hasOwn = objectPrototype.hasOwnProperty;
const objectKeys = Object.keys;
const arrayIsArray = Array.isArray;
const encode = TextEncoder.prototype.encode;
const decode = TextDecoder.prototype.decode;
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const encoder = new TextEncoder();
const normalize = String.prototype.normalize;
const charCodeAt = String.prototype.charCodeAt;
const indexOf = String.prototype.indexOf;
const slice = String.prototype.slice;
const set = U8.prototype.set;
const sharedArrayBuffer = globalThis.SharedArrayBuffer;
const apply = Reflect.apply;
const descriptor = Object.getOwnPropertyDescriptor;
const typedArrayPrototype = getPrototypeOf(U8.prototype);
const bufferGetter = descriptor(typedArrayPrototype, 'buffer').get;
const byteLengthGetter = descriptor(typedArrayPrototype, 'byteLength').get;
const sharedArrayBufferPrototype = sharedArrayBuffer && sharedArrayBuffer.prototype;
const parse = JSON.parse;
const isProxy = types.isProxy;
const setConstructor = Set;
const setHas = Set.prototype.has;
const setAdd = Set.prototype.add;
const exceptions = [
  ['.githooks/pre-push', '100755', 'd8016a819c234d99c5e8b627e34e1349695b3a44'],
  ['viewpro-app/apps/app-new/.claude/skills/tanstack-form', '120000', 'd12d02091264079b6e212b88678e90f9651ec6e7'],
  ['viewpro-app/apps/app-new/.claude/skills/tanstack-query', '120000', 'a1aae1817a41407e92a0c2038623bdf7c146c4fd'],
];
export function validateTreeBytePolicy(input) {
  try {
    if (isProxy(input) || getPrototypeOf(input) !== U8.prototype) return false;
    if (sharedArrayBufferPrototype && getPrototypeOf(apply(bufferGetter, input, [])) === sharedArrayBufferPrototype) return false;
    const observed = new U8(apply(byteLengthGetter, input, [])); apply(set, observed, [input]);
    if (observed[0] === 0xef && observed[1] === 0xbb && observed[2] === 0xbf) return false;
    const text = apply(decode, decoder, [observed]);
    if (badText(text) || !same(observed, apply(encode, encoder, [text])) || duplicates(text)) return false;
    const value = parse(text);
    return clean(value) && policy(value);
  } catch { return false; }
}
function same(left, right) { if (left.length !== right.length) return false; for (let i = 0; i < left.length; i += 1) if (left[i] !== right[i]) return false; return true; }
function exact(value, names) { if (getPrototypeOf(value) !== objectPrototype || objectKeys(value).length !== names.length) return false; for (let i = 0; i < names.length; i += 1) if (!apply(hasOwn, value, [names[i]])) return false; return true; }
function badText(text) { for (let i = 0; i < text.length; i += 1) { const code = apply(charCodeAt, text, [i]); if (code === 0 || code === 0xfeff || (code >= 0xd800 && code <= 0xdfff)) return true; } return false; }
function clean(value) { if (typeof value === 'string') return !badText(value); if (arrayIsArray(value)) { for (let i = 0; i < value.length; i += 1) if (!clean(value[i])) return false; return true; } if (value && typeof value === 'object') { if (getPrototypeOf(value) !== objectPrototype) return false; const keys = objectKeys(value); for (let i = 0; i < keys.length; i += 1) if (!clean(value[keys[i]])) return false; } return true; }

function duplicates(text) {
  let i = 0; let duplicate = false;
  const white = () => { while (i < text.length && apply(indexOf, ' \n\r\t', [text[i]]) >= 0) i += 1; };
  const string = () => { const start = i++; while (i < text.length) { const code = apply(charCodeAt, text, [i++]); if (code === 92) { if (apply(charCodeAt, text, [i++]) === 117) i += 4; } else if (code === 34) break; } return parse(apply(slice, text, [start, i])); };
  const value = () => { white(); if (text[i] === '{') object(); else if (text[i] === '[') array(); else if (text[i] === '"') string(); else while (i < text.length && apply(indexOf, ',]} \n\r\t', [text[i]]) < 0) i += 1; };
  const object = () => { const names = new setConstructor(); i += 1; white(); while (text[i] !== '}') { const name = string(); if (apply(setHas, names, [name])) duplicate = true; apply(setAdd, names, [name]); white(); i += 1; value(); white(); if (text[i] === ',') { i += 1; white(); } else break; } if (text[i] === '}') i += 1; };
  const array = () => { i += 1; white(); while (text[i] !== ']') { value(); white(); if (text[i] === ',') { i += 1; white(); } else break; } if (text[i] === ']') i += 1; };
  value(); white(); return duplicate || i !== text.length;
}

function path(value) {
  if (typeof value !== 'string' || !value.length || value[0] === '/' || value[value.length - 1] === '/' || apply(normalize, value, ['NFC']) !== value) return false;
  let segment = '';
  for (let i = 0; i < value.length; i += 1) { const code = apply(charCodeAt, value, [i]); const char = value[i]; if (code <= 31 || (code >= 127 && code <= 159) || code === 0x25 || code === 0x5c || code === 0x7f || code === 0xfeff || (code >= 0xd800 && code <= 0xdfff)) return false; if (char === '/') { if (!segment || segment === '.' || segment === '..') return false; segment = ''; } else segment += char; }
  return segment !== '.' && segment !== '..';
}
function hash(value) { if (typeof value !== 'string' || value.length !== 40) return false; for (let i = 0; i < 40; i += 1) { const code = apply(charCodeAt, value, [i]); if (!((code >= 48 && code <= 57) || (code >= 97 && code <= 102))) return false; } return true; }
function policy(value) {
  if (!exact(value, ['schemaVersion', 'kind', 'default', 'exceptions']) || value.schemaVersion !== 1 || value.kind !== 'production-cutover-tree-byte-contract' || !exact(value.default, ['mode', 'type']) || value.default.mode !== '100644' || value.default.type !== 'blob' || !arrayIsArray(value.exceptions) || value.exceptions.length !== 3) return false;
  for (let i = 0; i < exceptions.length; i += 1) { const entry = value.exceptions[i]; const rule = exceptions[i]; if (!exact(entry, ['path', 'mode', 'type', 'hash']) || !path(entry.path) || !hash(entry.hash) || entry.path !== rule[0] || entry.mode !== rule[1] || entry.type !== 'blob' || entry.hash !== rule[2]) return false; }
  return true;
}
