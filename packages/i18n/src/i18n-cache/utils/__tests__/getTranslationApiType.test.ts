import { defaultRuntimeApiUrl } from 'generaltranslation/internal';
import { describe, expect, it } from 'vitest';
import {
  getTranslationApiType,
  TranslationApiType,
} from '../getTranslationApiType';

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
