import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getI18nConfig, initializeI18nConfig } from 'gt-i18n/internal';
import { useLocales } from '../i18n-config';
import { useLocale } from '../condition-store';
import { setReadonlyConditionStore } from '../../condition-store/singleton-operations';

vi.mock('react', () => ({
  useMemo: <T>(factory: () => T) => factory(),
}));
vi.mock('../../context/context', () => ({
  useGTContext: () => undefined,
}));

function resetConfig() {
  Reflect.deleteProperty(globalThis, '__generaltranslation');
}

describe('useLocales', () => {
  beforeEach(resetConfig);
  afterEach(resetConfig);

  it('returns configured spellings without rewriting the internal list', () => {
    initializeI18nConfig({
      defaultLocale: 'en-us',
      locales: ['en-us', 'en-gb', 'fr-fr'],
      customMapping: {
        'en-us': { code: 'en-US' },
        'en-gb': { code: 'en-GB' },
        'fr-fr': { code: 'fr-FR' },
      },
    });
    const internalLocales = getI18nConfig().getLocales();
    const originalLocales = [...internalLocales];
    const conditionStore = {
      getLocale: () => 'en-gb',
      getEnableI18n: () => true,
    };
    setReadonlyConditionStore(conditionStore);

    expect(useLocale()).toBe('en-gb');
    expect(useLocales()).toEqual(['en-us', 'en-gb', 'fr-fr']);
    expect(conditionStore.getLocale()).toBe('en-gb');
    expect(getI18nConfig().getLocales()).toBe(internalLocales);
    expect(internalLocales).toEqual(originalLocales);
    expect(getI18nConfig().determineLocale('en-gb')).toBe('en-gb');
  });

  it('preserves locale spelling when there is no custom mapping', () => {
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr-FR', 'en-gb'],
    });
    setReadonlyConditionStore({
      getLocale: () => 'en-gb',
      getEnableI18n: () => true,
    });

    expect(useLocale()).toBe('en-gb');
    expect(useLocales()).toEqual(['en', 'fr-FR', 'en-gb']);
  });
});
