import { describe, expect, it } from 'vitest';
import { hashMessage } from '../hashMessage';
import { hashStringMessage } from '../hashStringMessage';

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
