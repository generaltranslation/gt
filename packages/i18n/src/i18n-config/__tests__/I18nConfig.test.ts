import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupGTServicesEnabled } from '../../globals/getGTServicesEnabled';
import { I18nConfig } from '../I18nConfig';

describe('I18nConfig', () => {
  beforeEach(() => {
    setupGTServicesEnabled({
      cacheUrl: null,
      runtimeUrl: null,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults locales to the resolved default locale', () => {
    const config = new I18nConfig({ defaultLocale: 'fr' });

    expect(config.getLocales()).toEqual(['fr']);
  });

  it('enables i18n by default', () => {
    expect(new I18nConfig({ defaultLocale: 'en' }).getEnableI18n()).toBe(true);
  });

  it('honors an explicit enableI18n flag', () => {
    expect(
      new I18nConfig({ defaultLocale: 'en', enableI18n: false }).getEnableI18n()
    ).toBe(false);
    expect(
      new I18nConfig({ defaultLocale: 'en', enableI18n: true }).getEnableI18n()
    ).toBe(true);
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

  it('enables dev hot reload with dev credentials, a project id, and development environment', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const config = new I18nConfig({
      devApiKey: 'dev-key',
      projectId: 'project-id',
    });

    expect(config.isDevHotReloadEnabled()).toBe(true);
  });

  it.each([
    {
      name: 'missing dev API key',
      environment: 'development',
      config: {
        projectId: 'project-id',
      },
    },
    {
      name: 'missing project id',
      environment: 'development',
      config: {
        devApiKey: 'dev-key',
      },
    },
    {
      name: 'disabled runtime URL',
      environment: 'development',
      config: {
        devApiKey: 'dev-key',
        projectId: 'project-id',
        runtimeUrl: null,
      },
    },
    {
      name: 'production environment',
      environment: 'production',
      config: {
        devApiKey: 'dev-key',
        projectId: 'project-id',
      },
    },
  ])('disables dev hot reload for $name', ({ config, environment }) => {
    vi.stubEnv('NODE_ENV', environment);

    expect(new I18nConfig(config).isDevHotReloadEnabled()).toBe(false);
  });
});
