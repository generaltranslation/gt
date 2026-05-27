import { describe, expect, it } from 'vitest';
import { setReadonlyConditionStore } from '../../condition-store/singleton-operations';
import type { ReactI18nCache } from '../../i18n-cache/ReactI18nCache';
import { setReactI18nCache } from '../../i18n-cache/singleton-operations';
import { getShouldTranslate } from '../utils';

function setup({
  locale,
  enableI18n = true,
  locales = ['en', 'fr'],
  customMapping = {},
}: {
  locale: string;
  enableI18n?: boolean;
  locales?: string[];
  customMapping?: Record<string, { code: string; name: string }>;
}) {
  setReactI18nCache({
    getDefaultLocale: () => 'en',
    getLocales: () => locales,
    getCustomMapping: () => customMapping,
  } as ReactI18nCache);
  setReadonlyConditionStore({
    getLocale: () => locale,
    getEnableI18n: () => enableI18n,
  });
}

describe('getShouldTranslate', () => {
  it('returns false for the default locale', () => {
    setup({ locale: 'en' });

    expect(getShouldTranslate()).toBe(false);
  });

  it('returns true for supported non-default locales', () => {
    setup({ locale: 'fr' });

    expect(getShouldTranslate()).toBe(true);
  });

  it('returns true for custom mapped non-default locales', () => {
    setup({
      locale: 'brand-french',
      locales: ['en', 'fr', 'brand-french'],
      customMapping: {
        'brand-french': {
          code: 'fr',
          name: 'Brand French',
        },
      },
    });

    expect(getShouldTranslate()).toBe(true);
  });

  it('returns false when i18n is disabled', () => {
    setup({ locale: 'fr', enableI18n: false });

    expect(getShouldTranslate()).toBe(false);
  });
});
