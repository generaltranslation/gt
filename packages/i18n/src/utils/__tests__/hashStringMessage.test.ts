import { describe, expect, it } from 'vitest';
import { hashStringMessage } from '../hashStringMessage';
import { hashMessage } from '../hashMessage';

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
