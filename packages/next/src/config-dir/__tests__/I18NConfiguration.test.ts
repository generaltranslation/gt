import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18NConfiguration } from '../I18NConfiguration';
import { getI18NConfig } from '../getI18NConfig';
import { defaultWithGTConfigProps } from '../props/defaultWithGTConfigProps';
import { initializeI18nConfig } from 'gt-i18n/internal';

const mockI18nCacheParams = vi.hoisted(() => vi.fn());
const mockLookupTranslationWithFallback = vi.hoisted(() => vi.fn());
const mockLocaleConfig = vi.hoisted(() => ({
  defaultLocale: 'en',
  locales: ['en', 'fr'],
  customMapping: {},
  translationRequired: true,
  dialectTranslationRequired: false,
  enableI18n: true,
}));

vi.mock('gt-i18n/internal', () => ({
  getI18nConfig: () => ({
    getDefaultLocale: () => mockLocaleConfig.defaultLocale,
    getLocales: () => mockLocaleConfig.locales,
    getCustomMapping: () => mockLocaleConfig.customMapping,
    requiresTranslation: () =>
      mockLocaleConfig.enableI18n && mockLocaleConfig.translationRequired,
    isSameLanguage: () => mockLocaleConfig.dialectTranslationRequired,
    requiresDialectTranslation: () =>
      mockLocaleConfig.enableI18n &&
      mockLocaleConfig.translationRequired &&
      mockLocaleConfig.dialectTranslationRequired,
  }),
  initializeI18nConfig: (params: {
    defaultLocale?: string;
    locales?: string[];
    customMapping?: Record<string, unknown>;
  }) => {
    mockLocaleConfig.defaultLocale =
      params.defaultLocale ?? mockLocaleConfig.defaultLocale;
    mockLocaleConfig.locales = params.locales ?? mockLocaleConfig.locales;
    mockLocaleConfig.customMapping =
      params.customMapping ?? mockLocaleConfig.customMapping;
  },
  setupGTServicesEnabled: vi.fn(),
  setI18nCache: vi.fn(),
  I18nCache: class {
    constructor(params: {
      defaultLocale?: string;
      locales?: string[];
      customMapping?: Record<string, unknown>;
      enableI18n?: boolean;
    }) {
      mockI18nCacheParams(params);
      mockLocaleConfig.defaultLocale =
        params.defaultLocale ?? mockLocaleConfig.defaultLocale;
      mockLocaleConfig.locales = params.locales ?? mockLocaleConfig.locales;
      mockLocaleConfig.customMapping =
        params.customMapping ?? mockLocaleConfig.customMapping;
      mockLocaleConfig.enableI18n = params.enableI18n ?? true;
    }

    getGTClass() {
      return {
        translateMany: async () => ({}),
      };
    }

    getDefaultLocale() {
      return mockLocaleConfig.defaultLocale;
    }

    getLocales() {
      return mockLocaleConfig.locales;
    }

    getCustomMapping() {
      return mockLocaleConfig.customMapping;
    }

    getVersionId() {
      return undefined;
    }

    requiresTranslation() {
      return (
        mockLocaleConfig.enableI18n && mockLocaleConfig.translationRequired
      );
    }

    requiresDialectTranslation() {
      return (
        mockLocaleConfig.enableI18n &&
        mockLocaleConfig.translationRequired &&
        mockLocaleConfig.dialectTranslationRequired
      );
    }

    async loadTranslations() {
      return {};
    }

    lookupTranslation() {
      return undefined;
    }

    async lookupTranslationWithFallback(...args: unknown[]) {
      return mockLookupTranslationWithFallback(...args);
    }
  },
}));

type ConfigParams = ConstructorParameters<typeof I18NConfiguration>[0];
type GlobalWithI18NConfig = typeof globalThis & {
  _GENERALTRANSLATION_I18N_CONFIG_INSTANCE?: I18NConfiguration;
};

function createConfig(overrides: Partial<ConfigParams> = {}) {
  const configParams = {
    runtimeUrl: undefined,
    cacheUrl: null,
    loadTranslationsType: 'custom',
    loadDictionaryEnabled: false,
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    renderSettings: {
      method: 'default',
    },
    maxConcurrentRequests: 100,
    maxBatchSize: 25,
    batchInterval: 50,
    headersAndCookies: {},
    _usingPlugin: false,
    ...overrides,
  } as ConfigParams;
  initializeI18nConfig(configParams);
  return new I18NConfiguration(configParams);
}

function expectCacheParams(expected: unknown) {
  expect(mockI18nCacheParams).toHaveBeenLastCalledWith(
    expect.objectContaining(expected)
  );
}

function resetGlobalConfig() {
  const globalObj = globalThis as GlobalWithI18NConfig;
  delete globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE;
}

describe('I18NConfiguration', () => {
  beforeEach(() => {
    resetGlobalConfig();
    mockI18nCacheParams.mockReset();
    mockLookupTranslationWithFallback.mockReset();
    mockLookupTranslationWithFallback.mockResolvedValue('translated');
    vi.unstubAllEnvs();
    mockLocaleConfig.defaultLocale = 'en';
    mockLocaleConfig.locales = ['en', 'fr'];
    mockLocaleConfig.customMapping = {};
    mockLocaleConfig.translationRequired = true;
    mockLocaleConfig.dialectTranslationRequired = false;
    mockLocaleConfig.enableI18n = true;
  });

  it.each<[string, Partial<ConfigParams>, number | null]>([
    ['omitted', {}, null],
    [
      'remote',
      { cacheExpiryTime: 30_000, loadTranslationsType: 'remote' },
      30_000,
    ],
    [
      'custom',
      { cacheExpiryTime: 30_000, loadTranslationsType: 'custom' },
      null,
    ],
  ])('sets %s cache expiry config', (_name, overrides, cacheExpiryTime) => {
    createConfig(overrides);
    expectCacheParams({ cacheExpiryTime });
  });

  it('passes batch, runtime metadata, and timeout config to I18nCache', () => {
    createConfig({
      maxConcurrentRequests: 7,
      maxBatchSize: 3,
      batchInterval: 11,
      projectId: 'project-id',
      renderSettings: {
        method: 'replace',
        timeout: 4321,
      },
      description: 'Translate for clinicians.',
      modelProvider: 'openai',
    });

    expectCacheParams({
      batchConfig: {
        maxConcurrentRequests: 7,
        maxBatchSize: 3,
        batchInterval: 11,
      },
      runtimeTranslation: {
        timeout: 4321,
        metadata: {
          sourceLocale: 'en',
          timeout: 4321,
          projectId: 'project-id',
          publish: true,
          fast: true,
          description: 'Translate for clinicians.',
          modelProvider: 'openai',
        },
      },
    });
  });

  it('passes runtime fallback options directly to I18nCache lookups', async () => {
    const config = createConfig();

    await config.translate({
      source: 'Hello',
      targetLocale: 'fr',
      options: {
        $_hash: 'hash-id',
        $format: 'ICU',
        $context: 'Greeting',
        $id: 'message-id',
        $maxChars: 12,
      },
    });

    expect(mockLookupTranslationWithFallback).toHaveBeenCalledWith(
      'fr',
      'Hello',
      {
        $_hash: 'hash-id',
        $format: 'ICU',
        $context: 'Greeting',
        $id: 'message-id',
        $maxChars: 12,
      }
    );
  });

  it('exposes configured locale values and client custom mappings', () => {
    const customMapping = {
      'brand-french': {
        code: 'fr',
        name: 'Brand French',
      },
    };
    const config = createConfig({
      defaultLocale: 'en-US',
      locales: ['en-US', 'fr', 'brand-french'],
      customMapping,
    });

    expect(config.getDefaultLocale()).toBe('en-US');
    expect(config.getLocales()).toEqual(['en-US', 'fr', 'brand-french']);
    expect(config.getClientSideConfig()).toEqual(
      expect.objectContaining({
        customMapping,
      })
    );
  });

  it('reads locale values from gt-i18n config accessors', () => {
    const config = createConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
    });

    mockLocaleConfig.defaultLocale = 'es';
    mockLocaleConfig.locales = ['es', 'es-MX'];

    expect(config.getDefaultLocale()).toBe('es');
    expect(config.getLocales()).toEqual(['es', 'es-MX']);
  });

  it('reads client custom mappings from gt-i18n config accessors', () => {
    const config = createConfig();
    const customMapping = {
      'brand-french': {
        code: 'fr',
        name: 'Brand French',
      },
    };

    mockLocaleConfig.customMapping = customMapping;

    expect(config.getClientSideConfig()).toEqual(
      expect.objectContaining({
        customMapping,
      })
    );
  });

  it('initializes locale metadata from environment-backed config params', () => {
    const customMapping = {
      'brand-spanish': {
        code: 'es',
        name: 'Brand Spanish',
      },
    };
    vi.stubEnv(
      '_GENERALTRANSLATION_I18N_CONFIG_PARAMS',
      JSON.stringify({
        defaultLocale: 'en-US',
        locales: ['en-US', 'es', 'brand-spanish'],
        customMapping,
      })
    );

    const config = getI18NConfig();

    expect(config.getDefaultLocale()).toBe('en-US');
    expect(config.getLocales()).toEqual(['en-US', 'es', 'brand-spanish']);
    expect(config.getClientSideConfig()).toEqual(
      expect.objectContaining({
        customMapping,
      })
    );
  });

  it('initializes locale metadata in the default config fallback', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const config = getI18NConfig();

    expect(config.getDefaultLocale()).toBe(
      defaultWithGTConfigProps.defaultLocale
    );
    expect(config.getLocales()).toEqual([
      defaultWithGTConfigProps.defaultLocale,
    ]);
    warn.mockRestore();
  });

  it('checks translation and dialect requirements from locale config', () => {
    mockLocaleConfig.translationRequired = true;
    mockLocaleConfig.dialectTranslationRequired = true;

    const config = createConfig();

    expect(config.requiresTranslation('en-GB')).toEqual([true, true]);
  });

  it('does not require translation when translation loading is disabled', () => {
    mockLocaleConfig.translationRequired = true;
    mockLocaleConfig.dialectTranslationRequired = true;

    const config = createConfig({
      loadTranslationsType: 'disabled',
      loadDictionaryEnabled: false,
    });

    expect(config.requiresTranslation('fr')).toEqual([false, false]);
  });
});
