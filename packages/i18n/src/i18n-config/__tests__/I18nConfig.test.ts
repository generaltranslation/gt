import { describe, expect, it } from 'vitest';
import { I18nConfig } from '../I18nConfig';

describe('I18nConfig', () => {
  it('treats an empty string locale candidate as unsupported', () => {
    const config = new I18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    });

    expect(config.determineSupportedLocale('')).toBeUndefined();
    expect(config.resolveSupportedLocale('')).toBe('en');
  });
});
