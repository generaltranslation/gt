import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setupGTServicesEnabled } from '../../globals/getGTServicesEnabled';
import { I18nConfig } from '../I18nConfig';

describe('I18nConfig', () => {
  beforeEach(() => {
    setupGTServicesEnabled({
      cacheUrl: null,
      runtimeUrl: null,
    });
  });

  it('defaults locales to the resolved default locale', () => {
    const config = new I18nConfig({ defaultLocale: 'fr' });

    expect(config.getLocales()).toEqual(['fr']);
  });

  it('skips locale validation when GT services are disabled', () => {
    const config = new I18nConfig({
      defaultLocale: 'invalid-locale',
    });

    expect(config.getDefaultLocale()).toBe('invalid-locale');
  });

  it('validates configured locales when GT services are enabled', () => {
    setupGTServicesEnabled({ projectId: 'test-project' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(
      () =>
        new I18nConfig({
          defaultLocale: 'invalid-locale',
        })
    ).toThrow('Invalid I18nConfig locale configuration');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Locale "invalid-locale" is not valid')
    );

    errorSpy.mockRestore();
  });

  it('validates custom mapping locales when GT services are enabled', () => {
    setupGTServicesEnabled({ projectId: 'test-project' });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(
      () =>
        new I18nConfig({
          defaultLocale: 'en',
          customMapping: {
            invalidStringMapping: 'invalid-locale',
            invalidObjectMapping: {
              code: 'invalid-object-locale',
            },
          },
        })
    ).toThrow('Invalid I18nConfig locale configuration');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Locale "invalid-locale" is not valid')
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Locale "invalid-object-locale" is not valid')
    );

    errorSpy.mockRestore();
  });

  it('treats an empty string locale candidate as unsupported', () => {
    const config = new I18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    });

    expect(config.determineSupportedLocale('')).toBeUndefined();
    expect(config.resolveSupportedLocale('')).toBe('en');
  });

  it('supports one-off locale config overrides', () => {
    const config = new I18nConfig({
      defaultLocale: 'en',
      locales: ['en'],
    });

    expect(
      config.determineSupportedLocale('brand-french', {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
        customMapping: {
          'brand-french': {
            code: 'fr',
            name: 'Brand French',
          },
        },
      })
    ).toBe('fr');
  });

  it('stores runtime config values', () => {
    const config = new I18nConfig({
      projectId: 'project-id',
      devApiKey: 'gt-dev-key',
      runtimeUrl: 'https://runtime.example.com',
      cacheUrl: 'https://cache.example.com',
      loadTranslationsType: 'remote',
    });

    expect(config.getProjectId()).toBe('project-id');
    expect(config.getDevApiKey()).toBe('gt-dev-key');
    expect(config.getRuntimeUrl()).toBe('https://runtime.example.com');
    expect(config.getTranslationEnabled()).toBe(true);
  });
});
