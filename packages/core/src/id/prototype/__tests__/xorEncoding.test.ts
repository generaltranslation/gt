import { describe, expect, it } from 'vitest';
import { hashSource } from '../../hashSource';
import { encodeForHash, fnv1a32 } from '../xorEncoding';

describe('XOR hashing proposal prototype', () => {
  it('computes FNV-1a over UTF-8 bytes', () => {
    // Reference values of 32-bit FNV-1a.
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
    expect(fnv1a32('bar', fnv1a32('foo'))).toBe(fnv1a32('foobar'));
    const viaBuffer = (input: string) => {
      let hash = 0x811c9dc5;
      for (const byte of Buffer.from(input, 'utf8'))
        hash = Math.imul(hash ^ byte, 0x01000193);
      return hash >>> 0;
    };
    for (const input of ['é', '–…', '日本語', '😀 ok', 'a\u07ffb\uffffc']) {
      expect(fnv1a32(input)).toBe(viaBuffer(input));
    }
  });

  it('keeps the default mode unchanged', () => {
    const input = { source: 'Save', dataFormat: 'ICU' as const };
    expect(hashSource(input, undefined, 'default')).toBe(hashSource(input));
  });

  it('ignores key order in every mode', () => {
    const element = (b: Record<string, string>) => ({
      source: [{ c: 'Hi', d: { b, t: 'plural' }, i: 1 }],
      dataFormat: 'JSX' as const,
    });
    for (const mode of ['default', 'linear', 'fnv32'] as const) {
      expect(
        hashSource(element({ one: 'a', other: 'b' }), undefined, mode)
      ).toBe(hashSource(element({ other: 'b', one: 'a' }), undefined, mode));
    }
  });

  // The final SHA-256 sees only the top-level object's encoding, which in
  // fnv32 mode is the 32-bit XOR, so distinct messages collide at birthday
  // rates for 32 bits (about one in 77k messages).
  it('reduces every message to 32 bits in fnv32 mode', () => {
    expect(
      encodeForHash({ source: 'Cancelled', dataFormat: 'ICU' }, 'fnv32')
    ).toMatch(/^o2_[0-9a-f]{1,8}$/);
    const a = { source: 'Item 1512789 was moved', dataFormat: 'ICU' as const };
    const b = { source: 'Item 1749192 was moved', dataFormat: 'ICU' as const };
    expect(hashSource(a, undefined, 'fnv32')).toBe(
      hashSource(b, undefined, 'fnv32')
    );
    expect(hashSource(a, undefined, 'linear')).not.toBe(
      hashSource(b, undefined, 'linear')
    );
    expect(hashSource(a)).not.toBe(hashSource(b));
  });
});
