import { describe, expect, it, vi } from 'vitest';
import { I18nConfig } from '../I18nConfig';

describe('I18nConfig', () => {
  it('defaults locales to the resolved default locale', () => {
    const config = new I18nConfig({ defaultLocale: 'fr' });

    expect(config.getLocales()).toEqual(['fr']);
  });

  it('skips locale validation when GT services are disabled', () => {
    const config = new I18nConfig({
      defaultLocale: 'invalid-locale',
      cacheUrl: null,
      runtimeUrl: null,
    });

    expect(config.getDefaultLocale()).toBe('invalid-locale');
  });

  it('validates configured locales when GT services are enabled', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(
      () =>
        new I18nConfig({
          defaultLocale: 'invalid-locale',
          projectId: 'test-project',
        })
    ).toThrow('Invalid I18nConfig locale configuration');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Locale "invalid-locale" is not valid')
    );

    errorSpy.mockRestore();
  });
});
