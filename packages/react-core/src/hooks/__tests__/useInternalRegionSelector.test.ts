import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from 'gt-i18n/internal';
import { useLocales } from '../i18n-config';
import { useLocale, useRegion } from '../condition-store';
import { useInternalRegionSelector } from '../useInternalRegionSelector';

vi.mock('react', () => ({
  useMemo: <T>(factory: () => T) => factory(),
}));

vi.mock('../i18n-config', () => ({
  useLocales: vi.fn(),
}));

vi.mock('../condition-store', () => ({
  useLocale: vi.fn(),
  useRegion: vi.fn(),
}));

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

const customMapping = {
  'brand-french': {
    code: 'fr-FR',
    name: 'Brand French',
    regionCode: 'FR',
    regionName: 'Brand France',
    emoji: '🥖',
  },
};

describe('useInternalRegionSelector', () => {
  beforeEach(() => {
    resetGTGlobals();
    // No credentials: region data comes from the locale configuration only.
    initializeI18nConfig({
      defaultLocale: 'en-US',
      locales: ['en-US', 'fr-FR', 'brand-french'],
      customMapping,
    });
    vi.mocked(useLocales).mockReturnValue(['en-US', 'fr-FR', 'brand-french']);
    vi.mocked(useLocale).mockReturnValue('fr-FR');
    vi.mocked(useRegion).mockReturnValue(undefined);
  });
  afterEach(resetGTGlobals);

  it('names regions in the current locale and applies customMapping region entries', () => {
    const { regionData } = useInternalRegionSelector();

    expect(regionData.get('US')).toMatchObject({
      code: 'US',
      name: new Intl.DisplayNames(['fr-FR'], { type: 'region' }).of('US'),
    });
    expect(regionData.get('FR')).toMatchObject({
      code: 'FR',
      name: 'Brand France',
      emoji: '🥖',
      locale: 'brand-french',
    });
  });

  it.each(['portal_de', 'de'])(
    'keeps %s for its own region when another locale shares it',
    (active) => {
      const aliasMapping = { portal_de: { code: 'de' } };
      const locales = ['en-US', 'de', 'portal_de'];
      resetGTGlobals();
      initializeI18nConfig({
        defaultLocale: 'en-US',
        locales,
        customMapping: aliasMapping,
      });
      vi.mocked(useLocales).mockReturnValue(locales);
      vi.mocked(useLocale).mockReturnValue(active);

      const { regionData } = useInternalRegionSelector();

      expect(regionData.get('DE')?.locale).toBe(active);
      expect(regionData.get('US')?.locale).toBe('en-US');
    }
  );

  it('gives a region its first configured locale when another shares it', () => {
    const aliasMapping = { portal_de: { code: 'de' } };
    const locales = ['en-US', 'de', 'portal_de'];
    resetGTGlobals();
    initializeI18nConfig({
      defaultLocale: 'en-US',
      locales,
      customMapping: aliasMapping,
    });
    vi.mocked(useLocales).mockReturnValue(locales);
    vi.mocked(useLocale).mockReturnValue('en-US');

    expect(useInternalRegionSelector().regionData.get('DE')?.locale).toBe('de');
  });

  it('resolves an active custom alias to its region and names regions in its language', () => {
    const aliasMapping = { portal_de: { code: 'de' } };
    resetGTGlobals();
    initializeI18nConfig({
      defaultLocale: 'en-US',
      locales: ['en-US', 'portal_de'],
      customMapping: aliasMapping,
    });
    vi.mocked(useLocales).mockReturnValue(['en-US', 'portal_de']);
    vi.mocked(useLocale).mockReturnValue('portal_de');

    const { localeRegion, regions, regionData } = useInternalRegionSelector();

    expect(localeRegion).toBe('DE');
    expect(regions).toEqual(['DE', 'US']);
    expect(regionData.get('US')).toMatchObject({
      name: new Intl.DisplayNames(['de'], { type: 'region' }).of('US'),
      locale: 'en-US',
    });
  });
});
