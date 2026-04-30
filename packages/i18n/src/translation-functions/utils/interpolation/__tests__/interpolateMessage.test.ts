import { describe, expect, it } from 'vitest';
import { I18nManager } from '../../../../i18n-manager/I18nManager';
import { setI18nManager } from '../../../../i18n-manager/singleton-operations';
import { interpolateMessage } from '../interpolateMessage';

describe('interpolateMessage', () => {
  it('formats missing translation fallback with the default locale', () => {
    setI18nManager(
      new I18nManager({
        defaultLocale: 'en-US',
        locales: ['en-US', 'fr'],
        loadTranslations: async () => ({}),
      })
    );

    expect(
      interpolateMessage({
        source: 'Value {n, number}',
        target: undefined,
        options: {
          $format: 'ICU',
          $locale: 'fr',
          n: 1234.5,
        },
      })
    ).toBe('Value 1,234.5');
  });
});
