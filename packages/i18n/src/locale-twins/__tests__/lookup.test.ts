/**
 * Locale twins at runtime: stripped client code carries only `$_hash`, so
 * lookups must resolve from the twin registry (source locale included), the
 * client must not load whole locales, and a mismatch between the twin-mode
 * flag, the registry and the resolved locale is reported.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nCache } from '../../i18n-cache/I18nCache';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';
import type { I18nConfigParams } from '../../i18n-config/I18nConfig';
import { getGTInternal } from '../../translation-functions/internal/getGT';
import { getMessagesInternal } from '../../translation-functions/internal/getMessages';
import { setI18nCache } from '../../i18n-cache/singleton-operations';
import { msg } from '../../translation-functions/msg/msg';
import { encodeLocaleTwinPlaceholder } from 'generaltranslation/internal';
import { hashSource } from 'generaltranslation/id';
import { registerLocaleTwin } from '../registry';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

const GREETING_HASH = '0123456789abcdef';
const SAVE_HASH = '1111111111111111';
const NAMED_HASH = '2222222222222222';

const TWINS_CONFIG: I18nConfigParams = {
  defaultLocale: 'en',
  locales: ['en', 'fr'],
  files: { gt: { output: 'src/_gt/[locale].json', splitting: 'locale-twins' } },
};

function register(locale: string, entries: Record<string, unknown>) {
  return registerLocaleTwin(JSON.stringify({ l: locale, e: entries }));
}

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

/** Pretends to be a browser so the client-only twin behaviour applies. */
function stubBrowser() {
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('document', {});
}

function createCache(
  config: I18nConfigParams = TWINS_CONFIG,
  cacheParams: ConstructorParameters<typeof I18nCache>[0] = {}
) {
  initializeI18nConfig(config);
  const cache = new I18nCache(cacheParams);
  setI18nCache(cache);
  return cache;
}

describe('locale twins runtime lookups', () => {
  beforeEach(() => {
    resetGTGlobals();
    stubBrowser();
  });

  afterEach(() => {
    resetGTGlobals();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('resolves stripped source-locale content from the registry', () => {
    register('en', { [GREETING_HASH]: 'Hello {name}' });
    const cache = createCache();

    expect(
      cache.lookupTranslation('en', '', {
        $format: 'ICU',
        $_hash: GREETING_HASH,
      })
    ).toBe('Hello {name}');
  });

  it('translates with getGT() from the registry without loading the locale or calling the CDN', async () => {
    register('fr', { [GREETING_HASH]: 'Bonjour {name}' });
    const loadTranslations = vi.fn().mockResolvedValue({});
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    createCache(
      { ...TWINS_CONFIG, projectId: 'project' },
      { loadTranslations }
    );

    const gt = await getGTInternal({ locale: 'fr', enableI18n: true });

    expect(gt('', { name: 'Ada', $_hash: GREETING_HASH })).toBe('Bonjour Ada');
    expect(loadTranslations).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not use the CDN for a configured projectId', async () => {
    register('fr', { [GREETING_HASH]: 'Bonjour {name}' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const cache = createCache(
      { ...TWINS_CONFIG, projectId: 'project' },
      {
        projectId: 'project',
      }
    );

    await cache.loadTranslations('fr');
    await getGTInternal({ locale: 'fr', enableI18n: true });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('resolves stripped msg() values with m(), source locale included', async () => {
    register('en', {
      [GREETING_HASH]: 'Hello {name}',
      [SAVE_HASH]: 'Save',
    });
    createCache();
    const greeting = msg('', { name: 'Ada', $_hash: GREETING_HASH });
    const save = msg('', { $format: 'STRING', $_hash: SAVE_HASH });

    const m = await getMessagesInternal({ locale: 'en', enableI18n: true });

    expect(m(greeting)).toBe('Hello Ada');
    expect(m(save)).toBe('Save');
  });

  describe('mismatch diagnostics', () => {
    it('reports once when twin mode is on but no twin was registered', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      createCache();

      const gt = await getGTInternal({ locale: 'fr', enableI18n: true });
      gt('', { $_hash: GREETING_HASH });
      gt('', { $_hash: SAVE_HASH });

      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0][0]).toMatch(
        /gt-i18n.*Error.*no locale twin was registered/s
      );
    });

    // Every module the compiler plugin builds installs the locale twin
    // runtime, so a lookup without one means the plugin is missing
    it('reports lookups without a hash once when nothing installed the twin runtime', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      createCache();

      const gt = await getGTInternal({ locale: 'fr', enableI18n: true });
      gt('Hello');
      gt('Hello');

      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0][0]).toContain('compiler plugin');
    });

    it('does not report lookups without a hash once the twin runtime is installed', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      registerLocaleTwin();
      createCache();

      const gt = await getGTInternal({ locale: 'fr', enableI18n: true });

      expect(gt('Hello')).toBe('Hello');
      expect(error).not.toHaveBeenCalled();
    });

    it('reports once when twins are registered but twin mode is off', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      register('fr', {
        [GREETING_HASH]: 'Bonjour',
        [SAVE_HASH]: 'Enregistrer',
      });
      const cache = createCache({ defaultLocale: 'en', locales: ['en', 'fr'] });

      expect(
        cache.lookupTranslation('fr', '', {
          $format: 'ICU',
          $_hash: GREETING_HASH,
        })
      ).toBe('Bonjour');
      cache.lookupTranslation('fr', '', { $format: 'ICU', $_hash: SAVE_HASH });

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toMatch(
        /gt-i18n.*Warning.*files\.gt\.splitting/s
      );
    });

    it('reports once when the registered twin locale differs from the rendered locale', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      register('fr', {
        [GREETING_HASH]: 'Bonjour',
        [SAVE_HASH]: 'Enregistrer',
      });
      const cache = createCache({
        ...TWINS_CONFIG,
        locales: ['en', 'fr', 'es'],
      });

      cache.lookupTranslation('es', '', {
        $format: 'ICU',
        $_hash: GREETING_HASH,
      });
      cache.lookupTranslation('es', '', { $format: 'ICU', $_hash: SAVE_HASH });

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toMatch(/"fr".*"es"/s);
    });

    it('stays silent when the flag, the registry and the locale agree', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      register('fr', { [GREETING_HASH]: 'Bonjour' });
      const cache = createCache();

      cache.lookupTranslation('fr', '', {
        $format: 'ICU',
        $_hash: GREETING_HASH,
      });

      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });
  });

  it('keeps loading whole locales on the server', async () => {
    vi.unstubAllGlobals();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const loadTranslations = vi.fn().mockResolvedValue({
      [GREETING_HASH]: 'Bonjour {name}',
    });
    createCache(TWINS_CONFIG, { loadTranslations });

    const gt = await getGTInternal({ locale: 'fr', enableI18n: true });

    expect(gt('Hello {name}', { name: 'Ada', $_hash: GREETING_HASH })).toBe(
      'Bonjour Ada'
    );
    expect(loadTranslations).toHaveBeenCalledWith('fr');
    expect(error).not.toHaveBeenCalled();
  });

  it('keeps unattributed entries (no $_hash) rendering from code', async () => {
    register('fr', { [GREETING_HASH]: 'Bonjour {name}' });
    createCache();

    const gt = await getGTInternal({ locale: 'en', enableI18n: true });

    expect(gt('Hi {name}', { name: 'Ada' })).toBe('Hi Ada');
    expect(gt('Hi {name}', { name: 'Ada', $_hash: NAMED_HASH })).toBe('Hi Ada');
  });

  // Content without a compile-time hash renders as source with locale twins
  // (the client cannot load it), on the server too, so a route loader that
  // runs on both sides returns the same text (React lookups do the same)
  it('renders unattributed entries as source on the server with getGT() and getMessages()', async () => {
    vi.unstubAllGlobals();
    // What the server bundle's modules do
    registerLocaleTwin(encodeLocaleTwinPlaceholder({ [SAVE_HASH]: 'Save' }));
    registerLocaleTwin();
    const loadTranslations = vi.fn().mockResolvedValue({
      [hashSource({ source: 'Season', dataFormat: 'ICU' })]: 'Saison',
      [GREETING_HASH]: 'Bonjour {name}',
    });
    createCache(TWINS_CONFIG, { loadTranslations });

    const gt = await getGTInternal({ locale: 'fr', enableI18n: true });
    const m = await getMessagesInternal({ locale: 'fr', enableI18n: true });

    expect(gt('Season')).toBe('Season');
    expect(m('Season')).toBe('Season');
    expect(gt('Hello {name}', { name: 'Ada', $_hash: GREETING_HASH })).toBe(
      'Bonjour Ada'
    );
  });

  it('formats a source fallback from the registry in the source locale with getGT()', async () => {
    registerLocaleTwin(
      JSON.stringify({
        l: 'fr',
        e: { [GREETING_HASH]: '{n, plural, one {# boat} other {# boats}}' },
        s: [GREETING_HASH],
      })
    );
    createCache();

    const gt = await getGTInternal({ locale: 'fr', enableI18n: true });

    expect(gt('', { n: 0, $_hash: GREETING_HASH })).toBe('0 boats');
  });
});
