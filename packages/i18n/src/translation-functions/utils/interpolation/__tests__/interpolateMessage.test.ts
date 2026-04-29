import { describe, expect, it } from 'vitest';
import { interpolateMessage } from '../interpolateMessage';

describe('interpolateMessage', () => {
  it('formats missing translation fallback with the provided locale', () => {
    expect(
      interpolateMessage({
        source: 'Value {n, number}',
        target: undefined,
        options: {
          $format: 'ICU',
          $locale: 'en',
          n: 1234.5,
        },
      })
    ).toBe('Value 1,234.5');
  });
});
