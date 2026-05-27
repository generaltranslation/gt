import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18NConfiguration } from '../I18NConfiguration';

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

function createConfig(overrides: Partial<ConfigParams> = {}) {
  return new I18NConfiguration({
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
  });
}

function expectCacheParams(expected: unknown) {
  expect(mockI18nCacheParams).toHaveBeenLastCalledWith(
    expect.objectContaining(expected)
  );
}

describe('I18NConfiguration', () => {
  beforeEach(() => {
    mockI18nCacheParams.mockReset();
    mockLookupTranslationWithFallback.mockReset();
    mockLookupTranslationWithFallback.mockResolvedValue('translated');
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
