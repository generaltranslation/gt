import { describe, it, expect } from 'vitest';
import { hashSource } from 'generaltranslation/id';
import { indexVars } from 'generaltranslation/internal';
import { hashContent } from '../hashContent';
import { hashStringMessage } from '../hashStringMessage';

describe('hashContent', () => {
  // ===== REGRESSION ===== //

  it('produces consistent hashes for same input', () => {
    const hash1 = hashContent('Hello {name}!', {
      $format: 'ICU',
      $context: 'greeting',
    });
    const hash2 = hashContent('Hello {name}!', {
      $format: 'ICU',
      $context: 'greeting',
    });

    expect(hash1).toBe(hash2);
    expect(typeof hash1).toBe('string');
    expect(hash1.length).toBeGreaterThan(0);
  });

  // ===== NEW BEHAVIOR ===== //

  it('applies indexVars only for ICU format', () => {
    const source = 'Hello {_gt_, select, other {Ada}}!';
    const indexed = indexVars(source);
    expect(indexed).not.toBe(source);

    expect(hashContent(source, { $format: 'ICU' })).toBe(
      hashSource({ source: indexed, dataFormat: 'ICU' })
    );
    expect(hashContent(source, { $format: 'STRING' })).toBe(
      hashSource({ source, dataFormat: 'STRING' })
    );
  });

  it('uses an explicit hash when provided', () => {
    expect(
      hashContent('Hello {name}!', {
        $format: 'ICU',
        $_hash: 'precomputed-hash',
      })
    ).toBe('precomputed-hash');
  });

  it('uses an explicit empty hash when provided', () => {
    expect(
      hashContent('Hello {name}!', {
        $format: 'ICU',
        $_hash: '',
      })
    ).toBe('');
  });

  it('does not include custom id in calculated hashes', () => {
    const hash1 = hashContent('Hello {name}!', {
      $format: 'ICU',
      $id: 'first',
    });
    const hash2 = hashContent('Hello {name}!', {
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
  ] as const)('matches hashContent for $name', ({ options }) => {
    const message = 'Literal {name}: 你好';

    expect(hashStringMessage(message, options)).toBe(
      hashContent(message, { ...options, $format: 'STRING' })
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
