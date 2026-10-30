import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { I18nConfig } from '../I18nConfig';

describe('I18nConfig', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    { services: false, expected: 'en-us' },
    { services: true, expected: 'en-us' },
  ])(
    'preserves the configured locale identity with services=$services',
    ({ services, expected }) => {
      const config = new I18nConfig({
        defaultLocale: 'en-us',
        locales: ['en-us', 'fr'],
        ...(services
          ? { projectId: 'test-project' }
          : { cacheUrl: null, runtimeUrl: null }),
      });
      // I18nConfig preserves supplied keys; framework configuration owns normalization.
      expect(config.determineSupportedLocale('en-US')).toBe(expected);
      expect(config.resolveSupportedLocale('en-US')).toBe(expected);
    }
  );

  it('defaults missing locale settings', () => {
    const config = new I18nConfig();

    expect(config.getDefaultLocale()).toBe(libraryDefaultLocale);
    expect(config.getLocales()).toEqual([libraryDefaultLocale]);
  });

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
    expect(
      () =>
        new I18nConfig({
          defaultLocale: 'invalid-locale',
          projectId: 'test-project',
        })
    ).toThrow(
      /Invalid I18nConfig locale configuration.*Invalid locale: invalid-locale/
    );
  });

  it('validates custom mapping locales when GT services are enabled', () => {
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
    ).toThrow(
      /Invalid locale: invalid-locale, Invalid locale: invalid-object-locale/
    );
  });

  it('skips a null custom mapping entry from an unvalidated config', () => {
    expect(
      () =>
        new I18nConfig({
          defaultLocale: 'en',
          projectId: 'test-project',
          customMapping: { cn: null as never },
        })
    ).not.toThrow();
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

  it('supports the default locale in one-off overrides that do not list it', () => {
    const config = new I18nConfig({ defaultLocale: 'en', locales: ['ja'] });

    // A locale cookie choosing the default must win over Accept-Language.
    expect(
      config.resolveSupportedLocale(['en', 'ja'], {
        defaultLocale: 'en',
        locales: ['ja'],
      })
    ).toBe('en');
  });

  it('resolves locales with the configured localeMatcher, including one-off overrides', () => {
    const config = new I18nConfig({
      defaultLocale: 'en-GB',
      localeMatcher: 'lookup',
    });

    expect(config.localeMatcher).toBe('lookup');
    expect(config.determineSupportedLocale('en')).toBeUndefined();
    expect(
      config.determineSupportedLocale('fr', { locales: ['fr-FR'] })
    ).toBeUndefined();
    expect(
      new I18nConfig({ defaultLocale: 'en-GB' }).determineLocale('en')
    ).toBe('en-GB');
  });

  it('sends the dev API key as the runtime API key when no API key is set', () => {
    vi.stubEnv('GT_API_KEY', '');
    const runtime = (params: { apiKey?: string; devApiKey?: string }) =>
      new I18nConfig({
        projectId: 'project',
        ...params,
      }).getTranslationRuntime();

    expect(runtime({ devApiKey: 'dev-key' }).apiKey).toBe('dev-key');
    expect(runtime({ apiKey: 'key', devApiKey: 'dev-key' }).apiKey).toBe('key');
  });

  it('prefers the GT_API_KEY environment variable over the dev API key', () => {
    vi.stubEnv('GT_API_KEY', 'env-key');
    const runtime = (params: { apiKey?: string; devApiKey?: string }) =>
      new I18nConfig({
        projectId: 'project',
        ...params,
      }).getTranslationRuntime();

    expect(runtime({ devApiKey: 'dev-key' }).apiKey).toBe('env-key');
    expect(runtime({ apiKey: 'key', devApiKey: 'dev-key' }).apiKey).toBe('key');
  });

  it('builds a translation runtime only with a projectId and an API key', () => {
    vi.stubEnv('GT_API_KEY', '');

    expect(() =>
      new I18nConfig({ projectId: 'project' }).getTranslationRuntime()
    ).toThrow('Runtime translation needs an API key');
    expect(() =>
      new I18nConfig({ apiKey: 'key' }).getTranslationRuntime()
    ).toThrow('Runtime translation needs a projectId');
    expect(
      new I18nConfig({
        projectId: 'project',
        apiKey: 'key',
        defaultLocale: 'en',
        locales: ['es'],
      }).getTranslationRuntime()
    ).toMatchObject({
      projectId: 'project',
      localeConfig: { defaultLocale: 'en', locales: ['en', 'es'] },
    });
  });

  it('enables dev hot reload with dev credentials, a project id, and development environment', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const config = new I18nConfig({
      devApiKey: 'dev-key',
      projectId: 'project-id',
    });

    expect(config.isDevHotReloadEnabled()).toBe(true);
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
