/**
 * Locale twin clients resolve stripped content from the twin registry, source
 * locale included, and never ship or load a translations snapshot.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GtInternalRegisterLocaleTwin } from 'gt-i18n/internal';
import { ReactI18nCache } from '../../i18n-cache/ReactI18nCache';
import { setReactI18nCache } from '../../i18n-cache/singleton-operations';
import { setReadonlyConditionStore } from '../../condition-store/singleton-operations';
import {
  initializeI18nConfig,
  type ReactI18nConfigParams,
} from '../../setup/i18nConfig';
import { getTranslationsSnapshot } from '../helpers/getTranslationsSnapshot';
import { t } from '../translation/t';

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };

const HASH = '0123456789abcdef';

const TWINS_CONFIG: ReactI18nConfigParams = {
  defaultLocale: 'en',
  locales: ['en', 'fr'],
  files: { gt: { output: 'src/_gt/[locale].json', splitting: 'locale-twins' } },
};

function setup(locale: string, config = TWINS_CONFIG, enableI18n = true) {
  initializeI18nConfig(config, 'SPA');
  setReadonlyConditionStore({
    getLocale: () => locale,
    getRegion: () => undefined,
    getEnableI18n: () => enableI18n,
    setLocale: () => {},
    setRegion: () => {},
    setEnableI18n: () => {},
  });
  const loadTranslations = vi.fn(async () => ({ [HASH]: 'Bonjour {name}' }));
  setReactI18nCache(new ReactI18nCache({ loadTranslations }));
  return { loadTranslations };
}

function register(locale: string, entries: Record<string, unknown>) {
  GtInternalRegisterLocaleTwin(JSON.stringify({ l: locale, e: entries }));
}

describe('locale twins in react-core functions', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    vi.stubGlobal('window', globalThis);
    vi.stubGlobal('document', {});
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('t() renders stripped source-locale text from the registry', () => {
    register('en', { [HASH]: 'Hello {name}' });
    setup('en');

    expect(t('', { name: 'Ada', $_hash: HASH })).toBe('Hello Ada');
  });

  it('t() renders a translation from the registry', () => {
    register('fr', { [HASH]: 'Bonjour {name}' });
    setup('fr');

    expect(t('', { name: 'Ada', $_hash: HASH })).toBe('Bonjour Ada');
  });

  // With i18n disabled the served twins are the default locale's (source
  // text), whatever the locale preference
  it('t() renders the default locale twin when i18n is disabled', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    register('en', { [HASH]: 'Total: {n, number}' });
    setup('fr', TWINS_CONFIG, false);

    expect(t('', { n: 1234.5, $_hash: HASH })).toBe('Total: 1,234.5');
    expect(warn).not.toHaveBeenCalled();
  });

  it('getTranslationsSnapshot() loads nothing on a locale twin client', async () => {
    register('fr', { [HASH]: 'Bonjour {name}' });
    const { loadTranslations } = setup('fr');

    await expect(getTranslationsSnapshot('fr')).resolves.toEqual({ fr: {} });
    expect(loadTranslations).not.toHaveBeenCalled();
  });

  it('getTranslationsSnapshot() still loads the locale on the server', async () => {
    vi.unstubAllGlobals();
    const { loadTranslations } = setup('fr');

    await expect(getTranslationsSnapshot('fr')).resolves.toEqual({
      fr: { [HASH]: 'Bonjour {name}' },
    });
    expect(loadTranslations).toHaveBeenCalledWith('fr');
  });
});
