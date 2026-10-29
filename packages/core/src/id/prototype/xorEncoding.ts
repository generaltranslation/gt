// PROTOTYPE: the XOR + FNV-1a hashing proposal, implemented as specified so
// prototypes/icu-tree-wire-and-hash can measure it. Not used by default.
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';

/**
 * - `default`: today's sorted-key JSON + SHA-256.
 * - `linear`: XOR of a SHA-256 per key/value pair (the proposal's benchmark-only mode).
 * - `fnv32`: XOR of a 32-bit FNV-1a per key/value pair (the proposed mode).
 */
export type HashMode = 'default' | 'linear' | 'fnv32';

/**
 * FNV-1a over the UTF-8 bytes of `input`, without allocating them. FNV-1a
 * streams, so `fnv1a32(b, fnv1a32(a)) === fnv1a32(a + b)`.
 */
export function fnv1a32(input: string, hash = 0x811c9dc5): number {
  for (let i = 0; i < input.length; i++) {
    let code = input.charCodeAt(i);
    if (code < 0x80) {
      hash = Math.imul(hash ^ code, 0x01000193);
      continue;
    }
    if (code >= 0xd800 && code < 0xdc00 && i + 1 < input.length) {
      const low = input.charCodeAt(i + 1);
      if (low >= 0xdc00 && low < 0xe000) {
        code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
        i++;
      }
    }
    // UTF-8 bytes, applied in place so the loop never allocates.
    const prime = 0x01000193;
    if (code < 0x800) {
      hash = Math.imul(hash ^ (0xc0 | (code >> 6)), prime);
    } else {
      if (code < 0x10000) {
        hash = Math.imul(hash ^ (0xe0 | (code >> 12)), prime);
      } else {
        hash = Math.imul(hash ^ (0xf0 | (code >> 18)), prime);
        hash = Math.imul(hash ^ (0x80 | ((code >> 12) & 63)), prime);
      }
      hash = Math.imul(hash ^ (0x80 | ((code >> 6) & 63)), prime);
    }
    hash = Math.imul(hash ^ (0x80 | (code & 63)), prime);
  }
  return hash >>> 0;
}

/**
 * The proposal's type-tagged encoding. Objects are reduced to the XOR of
 * their pair hashes, written as unpadded hex, exactly as specified:
 *
 *   encodeForHash({ source: 'Hi', dataFormat: 'ICU' }, 'fnv32') // 'o2_<8 hex or fewer>'
 *
 * So the top-level object, and therefore the final SHA-256 input, carries only
 * the 32 bits of that XOR in `fnv32` mode.
 */
export function encodeForHash(
  value: unknown,
  mode: Exclude<HashMode, 'default'>
): string {
  if (value === null) return 'nl';
  if (value === undefined) return 'ud';
  if (typeof value === 'string') return `s${value.length}_${value}`;
  if (typeof value === 'number') return `n${String(value).length}_${value}`;
  if (typeof value === 'boolean') return value ? 'b1' : 'b0';
  if (Array.isArray(value)) {
    let inner = '';
    for (let i = 0; i < value.length; i++)
      inner += `${i}_${encodeForHash(value[i], mode)}`;
    return `a${value.length}_${inner}`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (mode === 'fnv32') {
    let xor = keys.length ? 0 : fnv1a32('');
    for (const key of keys) xor ^= pairFnv(key, record[key]);
    return `o${keys.length}_${(xor >>> 0).toString(16)}`;
  }
  const pairs = keys.map(
    (key) => `${key.length}_${key}${encodeForHash(record[key], mode)}`
  );
  const xor = new Uint8Array(32);
  for (const pair of keys.length ? pairs : ['']) {
    const digest = sha256(utf8ToBytes(pair));
    for (let i = 0; i < 32; i++) xor[i] ^= digest[i];
  }
  let hex = '';
  for (let i = 0; i < 32; i++) hex += xor[i].toString(16).padStart(2, '0');
  return `o${keys.length}_${hex}`;
}

// fnv1a32(`${key.length}_${key}${encodeForHash(value)}`), streamed so a long
// string value is never copied into a pair string.
function pairFnv(key: string, value: unknown): number {
  const hash = fnv1a32(`${key.length}_${key}`);
  return typeof value === 'string'
    ? fnv1a32(value, fnv1a32(`s${value.length}_`, hash))
    : fnv1a32(encodeForHash(value, 'fnv32'), hash);
}
