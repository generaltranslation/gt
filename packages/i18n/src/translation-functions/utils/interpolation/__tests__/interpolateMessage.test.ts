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

  it('cuts an ICU message with the terminator of its locale, like a string', () => {
    const cut = ($format: 'ICU' | 'STRING') =>
      interpolateMessage({
        source: 'Hello world',
        target: 'Bonjour le monde',
        options: { $format, $locale: 'fr', $maxChars: 9 },
        sourceLocale: 'en',
      });
    expect(cut('ICU')).toBe('Bonjour\u202f…');
    expect(cut('ICU')).toBe(cut('STRING'));
  });
});
