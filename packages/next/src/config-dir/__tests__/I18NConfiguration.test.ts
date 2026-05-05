import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18NConfiguration } from '../I18NConfiguration';

const mockI18nManagerParams = vi.hoisted(() => vi.fn());
const mockLookupTranslationWithFallback = vi.hoisted(() => vi.fn());

vi.mock('gt-i18n/internal', () => ({
  I18nManager: class {
    constructor(params: unknown) {
      mockI18nManagerParams(params);
    }

    getGTClass() {
      return {
        translateMany: async () => ({}),
      };
    }

    requiresTranslation() {
      return true;
    }

    requiresDialectTranslation() {
      return false;
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

function expectManagerParams(expected: unknown) {
  expect(mockI18nManagerParams).toHaveBeenLastCalledWith(
    expect.objectContaining(expected)
  );
}

describe('I18NConfiguration', () => {
  beforeEach(() => {
    mockI18nManagerParams.mockReset();
    mockLookupTranslationWithFallback.mockReset();
    mockLookupTranslationWithFallback.mockResolvedValue('translated');
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
    expectManagerParams({ cacheExpiryTime });
  });

  it('passes batch, runtime metadata, and timeout config to I18nManager', () => {
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

    expectManagerParams({
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

  it('passes runtime fallback options directly to I18nManager lookups', async () => {
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
});
