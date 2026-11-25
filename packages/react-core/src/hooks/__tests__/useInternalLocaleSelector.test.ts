import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from 'gt-i18n/internal';
import { useCustomMapping, useLocales } from '../i18n-config';
import { useLocale } from '../condition-store';
import { useInternalLocaleSelector } from '../useInternalLocaleSelector';

vi.mock('react', () => ({
  useMemo: <T>(factory: () => T) => factory(),
  useCallback: <T>(callback: T) => callback,
}));

vi.mock('../i18n-config', () => ({
  useCustomMapping: vi.fn(),
  useLocales: vi.fn(),
}));

vi.mock('../condition-store', () => ({
  useLocale: vi.fn(),
}));

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

const customMapping = { portal_fr: { code: 'fr' } };

describe('useInternalLocaleSelector', () => {
  beforeEach(() => {
    resetGTGlobals();
    initializeI18nConfig({
      defaultLocale: 'el',
      locales: ['el', 'portal_fr'],
      customMapping,
    });
    vi.mocked(useLocales).mockReturnValue(['el', 'portal_fr']);
    vi.mocked(useCustomMapping).mockReturnValue(customMapping);
    vi.mocked(useLocale).mockReturnValue('portal_fr');
  });
  afterEach(resetGTGlobals);

  it('names and sorts locales by their names when a custom alias is active', () => {
    const { locales, getLocaleProperties } = useInternalLocaleSelector();

    expect(getLocaleProperties('portal_fr').nativeNameWithRegionCode).toBe(
      'français'
    );
    expect(locales).toEqual(['portal_fr', 'el']);
  });
});
