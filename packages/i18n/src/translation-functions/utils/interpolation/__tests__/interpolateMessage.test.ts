import { describe, expect, it } from 'vitest';
import { interpolateMessage } from '../interpolateMessage';

describe('interpolateMessage', () => {
  it('formats missing translation fallback with the source locale', () => {
    expect(
      interpolateMessage({
        source: 'Value {n, number}',
        target: undefined,
        options: {
          $format: 'ICU',
          $locale: 'fr',
          n: 1234.5,
        },
        sourceLocale: 'en',
      })
    ).toBe('Value 1,234.5');
  });
});
