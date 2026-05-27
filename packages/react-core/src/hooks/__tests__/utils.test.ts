import { describe, expect, it, vi } from 'vitest';
import { I18nCache } from 'gt-i18n/internal';
import { setReadonlyConditionStore } from '../../condition-store/singleton-operations';
import { setReactI18nCache } from '../../i18n-cache/singleton-operations';
import { getShouldTranslate } from '../utils';

function setup({
  locale,
  enableI18n = true,
}: {
  locale: string;
  enableI18n?: boolean;
}) {
  setReactI18nCache(
    new I18nCache({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      loadTranslations: vi.fn(),
    })
  );
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

  it('returns false when i18n is disabled', () => {
    setup({ locale: 'fr', enableI18n: false });

    expect(getShouldTranslate()).toBe(false);
  });
});
