/**
 * Locale twins at runtime: each call site of client code carries its
 * content in its `$_twin` marker (`[locale, content]` in a locale twin, `0`
 * for content the compiler could not attribute). Lookups render it without
 * a registry, the client never loads whole locales (dictionaries excepted),
 * and mismatches between the build and the runtime are reported once.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashSource } from 'generaltranslation/id';
import { I18nCache } from '../../i18n-cache/I18nCache';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';
import type { I18nConfigParams } from '../../i18n-config/I18nConfig';
import { getGTInternal } from '../../translation-functions/internal/getGT';
import { getMessagesInternal } from '../../translation-functions/internal/getMessages';
import { setI18nCache } from '../../i18n-cache/singleton-operations';
import { decodeMsg } from '../../translation-functions/msg/decodeMsg';
import { msg } from '../../translation-functions/msg/msg';
import { resolveLocaleTwin } from '../lookup';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

const GREETING_HASH = '0123456789abcdef';

const TWINS_CONFIG: I18nConfigParams = {
  defaultLocale: 'en',
  locales: ['en', 'fr', 'es'],
  files: { gt: { output: 'src/_gt/[locale].json', splitting: 'locale-twins' } },
};

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

describe('locale twins on the client', () => {
  beforeEach(() => {
    resetGTGlobals();
    stubBrowser();
  });

  afterEach(() => {
    resetGTGlobals();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders the call site content of a twin with getGT(), source locale included', async () => {
    createCache();

    const fr = await getGTInternal({ locale: 'fr', enableI18n: true });
    const en = await getGTInternal({ locale: 'en', enableI18n: true });

    expect(fr('', { name: 'Ada', $_twin: ['fr', 'Bonjour {name}'] })).toBe(
      'Bonjour Ada'
    );
    expect(en('', { name: 'Ada', $_twin: ['en', 'Hello {name}'] })).toBe(
      'Hello Ada'
    );
  });

  it('loads no locale and calls no CDN, even with a projectId', async () => {
    const loadTranslations = vi.fn().mockResolvedValue({});
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const cache = createCache(
      { ...TWINS_CONFIG, projectId: 'project' },
      { loadTranslations, projectId: 'project' }
    );

    await cache.loadTranslations('fr');
    const gt = await getGTInternal({ locale: 'fr', enableI18n: true });
    gt('', { $_twin: ['fr', 'Bonjour'] });

    expect(loadTranslations).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // The twin's locale has no translation: the source text, formatted with
  // the source locale's plural rules, like a miss without locale twins
  it('formats a source fallback in the source locale', async () => {
    createCache();

    const gt = await getGTInternal({ locale: 'ja', enableI18n: true });

    expect(
      gt('', {
        n: 0,
        $_twin: ['en', '{n, plural, one {# boat} other {# boats}}'],
      })
    ).toBe('0 boats');
  });

  it('renders msg() content from its twin with m() and decodeMsg()', async () => {
    createCache();
    const greeting = msg('', {
      name: 'Ada',
      $_twin: ['fr', 'Bonjour {name}'],
    });
    const save = msg('', { $format: 'STRING', $_twin: ['fr', 'Enregistrer'] });

    const m = await getMessagesInternal({ locale: 'fr', enableI18n: true });

    expect(m(greeting)).toBe('Bonjour Ada');
    expect(m(save)).toBe('Enregistrer');
    expect(decodeMsg(greeting)).toBe('Bonjour Ada');
    expect(decodeMsg(save)).toBe('Enregistrer');
  });

  it('renders unattributed content (marker 0) as its source text', async () => {
    const loadTranslations = vi.fn().mockResolvedValue({});
    createCache(TWINS_CONFIG, { loadTranslations });

    const gt = await getGTInternal({ locale: 'fr', enableI18n: true });

    expect(gt('Hi {name}', { name: 'Ada', $_twin: 0 })).toBe('Hi Ada');
  });

  describe('diagnostics', () => {
    it('reports once when content renders without a locale twin (compiler plugin missing)', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      createCache();

      const gt = await getGTInternal({ locale: 'fr', enableI18n: true });
      expect(gt('Hello')).toBe('Hello');
      gt('', { $_hash: GREETING_HASH });

      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0][0]).toMatch(
        /gt-i18n.*Error.*without a locale twin.*compiler plugin/s
      );
    });

    // An original (untwinned) chunk carries the unfilled placeholder string
    it('reports once when a call site still has its unfilled placeholder', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      createCache();

      expect(
        resolveLocaleTwin('__GT_LOCALE_TWIN__:x:y', 'fr', 'en')
      ).toBeUndefined();

      expect(error).toHaveBeenCalledTimes(1);
    });

    it('stays silent for twin content and unattributed content', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      createCache();

      resolveLocaleTwin(['fr', 'Bonjour'], 'fr', 'en');
      resolveLocaleTwin(['en', 'Missing'], 'fr', 'en');
      resolveLocaleTwin(0, 'fr', 'en');

      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });

    // Twin content renders as built whatever the runtime config says: the
    // compiler checks the flag at build time instead (every app ships this)
    it('renders twin content without checking the runtime flag or locale', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      createCache({ defaultLocale: 'en', locales: ['en', 'fr'] });

      expect(resolveLocaleTwin(['fr', 'Bonjour'], 'es', 'en')).toEqual({
        locale: 'fr',
        target: 'Bonjour',
      });
      expect(warn).not.toHaveBeenCalled();
    });

    it('does not report dictionary lookups (they keep loading whole locales)', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      createCache();

      expect(resolveLocaleTwin(undefined, 'fr', 'en', true)).toBeUndefined();
      expect(error).not.toHaveBeenCalled();
    });
  });
});

describe('locale twins on the server', () => {
  beforeEach(resetGTGlobals);
  afterEach(() => {
    resetGTGlobals();
    vi.restoreAllMocks();
  });

  it('keeps loading whole locales and translating attributed entries', async () => {
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

  // The client renders it as source too, so a route loader that runs on
  // both sides returns the same text
  it('renders unattributed entries (marker 0) as source with getGT() and getMessages()', async () => {
    const loadTranslations = vi.fn().mockResolvedValue({
      [hashSource({ source: 'Season', dataFormat: 'ICU' })]: 'Saison',
    });
    createCache(TWINS_CONFIG, { loadTranslations });

    const gt = await getGTInternal({ locale: 'fr', enableI18n: true });
    const m = await getMessagesInternal({ locale: 'fr', enableI18n: true });

    expect(gt('Season', { $_twin: 0 })).toBe('Season');
    expect(m(msg('Season', { $_twin: 0 }))).toBe('Season');
    expect(gt('Season')).toBe('Saison');
  });
});

describe('dictionaries on a locale twin client', () => {
  const RUNTIME_HASH = 'fedcba9876543210';

  beforeEach(() => {
    resetGTGlobals();
    stubBrowser();
  });

  afterEach(() => {
    resetGTGlobals();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps loading whole locales when the app uses dictionaries', async () => {
    const loadTranslations = vi
      .fn()
      .mockResolvedValue({ [RUNTIME_HASH]: 'Titre' });
    const cache = createCache(TWINS_CONFIG, {
      loadTranslations,
      dictionary: { title: 'Title' },
    });

    await cache.loadTranslations('fr');

    expect(loadTranslations).toHaveBeenCalledWith('fr');
    expect(
      cache.lookupTranslation('fr', 'Title', {
        $format: 'ICU',
        $_hash: RUNTIME_HASH,
      })
    ).toBe('Titre');
  });

  it('loads nothing when the app uses no dictionaries', async () => {
    const loadTranslations = vi.fn().mockResolvedValue({});
    const cache = createCache(TWINS_CONFIG, { loadTranslations });

    await cache.loadTranslations('fr');

    expect(loadTranslations).not.toHaveBeenCalled();
  });
});
