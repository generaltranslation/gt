import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import {
  I18nConfig as BrowserI18nConfig,
  type I18nConfigParams,
} from '../I18nConfig';
import { RuntimeI18nConfig as I18nConfig } from '../RuntimeI18nConfig';

describe('I18nConfig', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults missing locale settings', () => {
    const config = new I18nConfig();

    expect(config.getDefaultLocale()).toBe(libraryDefaultLocale);
    expect(config.getLocales()).toEqual([libraryDefaultLocale]);
  });

  it('defaults locales to the resolved default locale', () => {
    const config = new I18nConfig({ defaultLocale: 'fr' });

    expect(config.getLocales()).toEqual(['fr']);
  });

  it('derives localized region overrides from the locale mapping', () => {
    const customMapping = {
      customEnglish: {
        code: 'en-US',
        regionCode: 'US',
        regionName: 'Custom United States',
        emoji: '🗽',
      },
    };
    const config = new I18nConfig({ customMapping });

    expect(config.getRegionProperties('US', 'en')).toMatchObject({
      name: 'Custom United States',
      emoji: '🗽',
      locale: 'customEnglish',
    });

    customMapping.customEnglish.regionName = 'Updated United States';
    expect(config.getRegionProperties('US', 'en').name).toBe(
      'Updated United States'
    );
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

  it('validates runtime-only GT configuration in browser builds', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(
      () =>
        new BrowserI18nConfig({
          defaultLocale: 'invalid-locale',
          projectId: 'test-project',
          apiKey: 'test-api-key',
          cacheUrl: null,
        })
    ).toThrow('Invalid I18nConfig locale configuration');
  });

  it('reports unavailable browser runtime APIs with a diagnostic', () => {
    const config = new BrowserI18nConfig();

    expect(() => config.getGTClass()).toThrow(
      'gt-i18n Error: GTRuntime is not available in production browser builds'
    );
  });

  it('validates custom mapping locales when GT services are enabled', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(
      () =>
        new I18nConfig({
          defaultLocale: 'en',
          projectId: 'test-project',
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

  it('copies runtime configuration at initialization', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const params: I18nConfigParams = {
      devApiKey: 'dev-key',
      projectId: 'project-id',
    };
    const config = new I18nConfig(params);

    params.devApiKey = undefined;
    params.projectId = undefined;

    expect(config.isDevHotReloadEnabled()).toBe(true);
    expect(config.getProjectId()).toBe('project-id');
  });

  it('disables dev hot reload when the config switch is set', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const config = new I18nConfig({
      devApiKey: 'dev-key',
      projectId: 'project-id',
      _disableDevHotReload: true,
    });

    expect(config.isDevHotReloadEnabled()).toBe(false);
  });

  it('stores the configured log level at initialization', () => {
    vi.stubEnv('_GENERALTRANSLATION_LOG_LEVEL', 'debug');

    const config = new I18nConfig();
    vi.stubEnv('_GENERALTRANSLATION_LOG_LEVEL', '');

    expect(config.isDebugLoggingEnabled()).toBe(true);
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
