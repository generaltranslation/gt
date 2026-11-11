import {
  defaultCacheUrl,
  defaultRuntimeApiUrl,
} from 'generaltranslation/internal';
import { describe, expect, it } from 'vitest';
import {
  getLoadTranslationsType,
  LoadTranslationsType,
} from '../getLoadTranslationsType';
import {
  getTranslationApiType,
  TranslationApiType,
} from '../getTranslationApiType';

describe('getLoadTranslationsType', () => {
  it.each([
    [
      'uses a custom loader when loadTranslations is provided',
      { loadTranslations: async () => ({}), projectId: 'test-project' },
      LoadTranslationsType.CUSTOM,
    ],
    [
      'uses the GT remote store when only a projectId is provided',
      { projectId: 'test-project' },
      LoadTranslationsType.GT_REMOTE,
    ],
    [
      'uses the GT remote store when the default cacheUrl is set explicitly',
      { projectId: 'test-project', cacheUrl: defaultCacheUrl },
      LoadTranslationsType.GT_REMOTE,
    ],
    [
      'uses a remote store when a custom cacheUrl is provided',
      { projectId: 'test-project', cacheUrl: 'https://example.com' },
      LoadTranslationsType.REMOTE,
    ],
    [
      'uses a remote store when a cacheUrl is provided without a projectId',
      { cacheUrl: 'https://example.com' },
      LoadTranslationsType.REMOTE,
    ],
    [
      'uses a remote store when the default cacheUrl is set without a projectId',
      { cacheUrl: defaultCacheUrl },
      LoadTranslationsType.REMOTE,
    ],
    [
      'disables loading when cacheUrl is null',
      { projectId: 'test-project', cacheUrl: null },
      LoadTranslationsType.DISABLED,
    ],
    [
      'disables loading when nothing is configured',
      {},
      LoadTranslationsType.DISABLED,
    ],
  ])('%s', (_description, config, expected) => {
    expect(getLoadTranslationsType(config)).toBe(expected);
  });
});

describe('getTranslationApiType', () => {
  it.each([
    [
      'disables runtime translation for the default URL without credentials',
      { runtimeUrl: defaultRuntimeApiUrl },
      TranslationApiType.DISABLED,
    ],
    [
      'uses the GT runtime API when default URL credentials are present',
      {
        projectId: 'test-project',
        devApiKey: 'test-key',
        runtimeUrl: defaultRuntimeApiUrl,
      },
      TranslationApiType.GT,
    ],
    [
      'uses custom runtime APIs without requiring GT credentials',
      { runtimeUrl: 'https://runtime.example.com' },
      TranslationApiType.CUSTOM,
    ],
  ])('%s', (_, params, expected) => {
    expect(getTranslationApiType(params)).toBe(expected);
  });
});
