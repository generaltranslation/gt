import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashSource } from 'generaltranslation/id';
import { hashMessage } from '../hashMessage';
import { hashStringMessage } from '../hashStringMessage';

vi.mock('generaltranslation/id', async (importOriginal) => {
  const actual = await importOriginal<typeof import('generaltranslation/id')>();
  return { ...actual, hashSource: vi.fn(actual.hashSource) };
});

describe('hashMessage', () => {
  // ===== REGRESSION ===== //

  it('produces consistent hashes for same input', () => {
    const hash1 = hashMessage('Hello {name}!', {
      $format: 'ICU',
      $context: 'greeting',
    });
    const hash2 = hashMessage('Hello {name}!', {
      $format: 'ICU',
      $context: 'greeting',
    });

    expect(hash1).toBe(hash2);
    expect(typeof hash1).toBe('string');
    expect(hash1.length).toBeGreaterThan(0);
  });

  // ===== NEW BEHAVIOR ===== //

  it('applies indexVars only for ICU format (ICU vs STRING hash differs)', () => {
    const icuHash = hashMessage('Hello {name}!', { $format: 'ICU' });
    const stringHash = hashMessage('Hello {name}!', { $format: 'STRING' });

    // ICU format applies indexVars() which transforms {name} → {0}
    // STRING format passes the message as-is
    // So the hashes should be different
    expect(icuHash).not.toBe(stringHash);
  });

  it('uses an explicit hash when provided', () => {
    expect(
      hashMessage('Hello {name}!', {
        $format: 'ICU',
        $_hash: 'precomputed-hash',
      })
    ).toBe('precomputed-hash');
  });

  it('uses an explicit empty hash when provided', () => {
    expect(
      hashMessage('Hello {name}!', {
        $format: 'ICU',
        $_hash: '',
      })
    ).toBe('');
  });

  it('does not include custom id in calculated hashes', () => {
    const hash1 = hashMessage('Hello {name}!', {
      $format: 'ICU',
      $id: 'first',
    });
    const hash2 = hashMessage('Hello {name}!', {
      $format: 'ICU',
      $id: 'second',
    });

    expect(hash1).toBe(hash2);
  });
});

describe('hashStringMessage', () => {
  it.each([
    { name: 'no metadata', options: {} },
    { name: 'context', options: { $context: 'navigation' } },
    { name: 'empty context', options: { $context: '' } },
    { name: 'negative max chars', options: { $maxChars: -12 } },
    { name: 'requires review', options: { $requiresReview: true } },
    {
      name: 'all persisted metadata',
      options: {
        $context: 'button',
        $maxChars: 20,
        $requiresReview: true,
      },
    },
  ] as const)('matches hashMessage for $name', ({ options }) => {
    const message = 'Literal {name}: 你好';

    expect(hashStringMessage(message, options)).toBe(
      hashMessage(message, { ...options, $format: 'STRING' })
    );
  });

  it('preserves an explicit hash, including an empty hash', () => {
    expect(hashStringMessage('Hello', { $_hash: 'compiled' })).toBe('compiled');
    expect(hashStringMessage('Hello', { $_hash: '' })).toBe('');
  });

  it('does not mix custom ids or interpolation variables into STRING hashes', () => {
    const expected = hashStringMessage('Hello {name}');

    expect(
      hashStringMessage('Hello {name}', {
        $id: 'custom',
        name: 'Ada',
      })
    ).toBe(expected);
  });
});

const hashSpy = vi.mocked(hashSource);

describe('hashMessage cache', () => {
  beforeEach(() => {
    hashSpy.mockClear();
  });

  it('hashes a repeated identical call once', () => {
    const first = hashMessage('Memo {count} items', {
      $format: 'ICU',
      $context: 'cart',
    });
    const second = hashMessage('Memo {count} items', {
      $format: 'ICU',
      $context: 'cart',
    });

    expect(second).toBe(first);
    expect(hashSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps calls that differ in any hashed option apart', () => {
    const message = 'Memo distinct options';
    const variants = [
      { $format: 'STRING' },
      { $format: 'ICU' },
      { $format: 'STRING', $context: 'menu' },
      { $format: 'STRING', $maxChars: 12 },
      { $format: 'STRING', $requiresReview: true },
    ] as const;

    const hashes = variants.map((options) => hashMessage(message, options));
    const repeated = variants.map((options) => hashMessage(message, options));

    expect(new Set(hashes).size).toBe(variants.length);
    expect(repeated).toEqual(hashes);
    expect(hashSpy).toHaveBeenCalledTimes(variants.length);
  });

  it('ignores $id and the sign of $maxChars, as the uncached hash does', () => {
    const base = hashMessage('Memo limits', {
      $format: 'STRING',
      $maxChars: 8,
    });

    expect(
      hashMessage('Memo limits', { $format: 'STRING', $maxChars: -8 })
    ).toBe(base);
    expect(
      hashMessage('Memo limits', {
        $format: 'STRING',
        $maxChars: 8,
        $id: 'limits.label',
      })
    ).toBe(base);
    expect(hashSpy).toHaveBeenCalledTimes(1);
  });
});
