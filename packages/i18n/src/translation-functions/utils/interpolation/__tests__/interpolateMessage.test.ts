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

  it('interpolates i18next translations', () => {
    expect(
      interpolateMessage({
        source: 'Hello {{name}}',
        target: 'Bonjour {{name}}',
        options: {
          $format: 'I18NEXT',
          $locale: 'fr',
          name: 'Ada',
        },
      })
    ).toBe('Bonjour Ada');
  });

  it('formats missing i18next translation fallback with the source locale', () => {
    expect(
      interpolateMessage({
        source: 'Value {{n, number}}',
        target: undefined,
        options: {
          $format: 'I18NEXT',
          $locale: 'fr',
          n: 1234.5,
        },
        sourceLocale: 'en',
      })
    ).toBe('Value 1,234.5');
  });
});
