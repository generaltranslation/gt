import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from 'gt-i18n/internal';
import { useCustomMapping, useLocales } from '../i18n-config';
import { useLocale, useRegion } from '../condition-store';
import { useInternalRegionSelector } from '../useInternalRegionSelector';

vi.mock('react', () => ({
  useMemo: <T>(factory: () => T) => factory(),
}));

vi.mock('../i18n-config', () => ({
  useCustomMapping: vi.fn(),
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
    vi.mocked(useCustomMapping).mockReturnValue(customMapping);
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
});
