import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultDefaultLocale } from '@generaltranslation/format/internal';
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
      expect(config.determineLocale('en-US')).toBe(expected);
      expect(config.resolveSupportedLocale('en-US')).toBe(expected);
    }
  );

  it('defaults missing locale settings', () => {
    const config = new I18nConfig();

    expect(config.getDefaultLocale()).toBe(defaultDefaultLocale);
    expect(config.getLocales()).toEqual([defaultDefaultLocale]);
  });

  it("formats dates and times in the host's time zone", () => {
    const config = new I18nConfig({ defaultLocale: 'en-US' });
    const date = new Date('2020-05-06T14:03:02Z');
    expect(config.timeZone).toBe(
      new Intl.DateTimeFormat().resolvedOptions().timeZone
    );
    expect(
      config.formatDateTime(date, { locale: 'en-US', timeStyle: 'short' })
    ).toBe(
      new Intl.DateTimeFormat('en-US', { timeStyle: 'short' }).format(date)
    );
  });

  it('formats dates and times in its configured time zone', () => {
    const config = new I18nConfig({
      defaultLocale: 'en-US',
      timeZone: 'Asia/Tokyo',
    });
    const date = new Date('2020-05-06T14:03:02Z');

    expect(config.formatDateTime(date, { timeStyle: 'short' })).toBe(
      new Intl.DateTimeFormat('en-US', {
        timeStyle: 'short',
        timeZone: 'Asia/Tokyo',
      }).format(date)
    );
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

    expect(config.determineLocale('')).toBeUndefined();
    expect(config.resolveSupportedLocale('')).toBe('en');
  });

  it('supports the default locale even when locales does not list it', () => {
    const config = new I18nConfig({ defaultLocale: 'en', locales: ['ja'] });

    // A locale cookie choosing the default must win over Accept-Language.
    expect(config.resolveSupportedLocale(['en', 'ja'])).toBe('en');
  });

  it('resolves locales with the configured localeMatcher', () => {
    const config = new I18nConfig({
      defaultLocale: 'en-GB',
      localeMatcher: 'lookup',
    });

    expect(config.localeMatcher).toBe('lookup');
    expect(config.determineLocale('en')).toBeUndefined();
    expect(config.resolveSupportedLocale('en')).toBe('en-GB');
    expect(
      new I18nConfig({ defaultLocale: 'en-GB' }).determineLocale('en')
    ).toBe('en-GB');
  });

  it('does not read the API key from the environment', () => {
    vi.stubEnv('GT_API_KEY', 'env-key');

    expect(() =>
      new I18nConfig({ projectId: 'project' }).getTranslationRuntime()
    ).toThrow('Runtime translation needs an API key');
    expect(
      new I18nConfig({
        projectId: 'project',
        apiKey: 'key',
      }).getTranslationRuntime().apiKey
    ).toBe('key');
  });

  it('builds a translation runtime only with a projectId and an API key', () => {
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

  it('enables dev hot reload with an API key, a project id, and development environment', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const config = new I18nConfig({
      apiKey: 'dev-key',
      projectId: 'project-id',
    });

    expect(config.isDevHotReloadEnabled()).toBe(true);
  });

  it('disables dev hot reload when the config switch is set', () => {
    vi.stubEnv('NODE_ENV', 'development');

    const config = new I18nConfig({
      apiKey: 'dev-key',
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
      name: 'missing API key',
      environment: 'development',
      config: {
        projectId: 'project-id',
      },
    },
    {
      name: 'missing project id',
      environment: 'development',
      config: {
        apiKey: 'dev-key',
      },
    },
    {
      name: 'disabled runtime URL',
      environment: 'development',
      config: {
        apiKey: 'dev-key',
        projectId: 'project-id',
        runtimeUrl: null,
      },
    },
    {
      name: 'production environment',
      environment: 'production',
      config: {
        apiKey: 'dev-key',
        projectId: 'project-id',
      },
    },
  ])('disables dev hot reload for $name', ({ config, environment }) => {
    vi.stubEnv('NODE_ENV', environment);

    expect(new I18nConfig(config).isDevHotReloadEnabled()).toBe(false);
  });
});
