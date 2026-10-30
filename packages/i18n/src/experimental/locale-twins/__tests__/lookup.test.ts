/**
 * Locale twins at runtime: stripped client code carries only `$_hash`, so
 * lookups must resolve from the twin registry (source locale included), the
 * client must not load whole locales, and a mismatch between the twin-mode
 * flag, the registry and the resolved locale is reported.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nCache } from '../../../i18n-cache/I18nCache';
import { initializeI18nConfig } from '../../../i18n-config/singleton-operations';
import type { I18nConfigParams } from '../../../i18n-config/I18nConfig';
import { setI18nCache } from '../../../i18n-cache/singleton-operations';
import type { GTConfig } from 'generaltranslation/types';
import { getGTInternal, getMessagesInternal } from '../translationFunctions';
import { msg } from '../msg';
import { msg as regularMsg } from '../../../translation-functions/msg/msg';
import { getLocaleTwinCacheParams, initializeLocaleTwins } from '../runtime';
import { encodeLocaleTwinPlaceholder } from 'generaltranslation/internal/experimental';
import { hashSource } from 'generaltranslation/id';
import { registerLocaleTwin } from '../registry';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

const GREETING_HASH = '0123456789abcdef';
const SAVE_HASH = '1111111111111111';
const NAMED_HASH = '2222222222222222';

type TwinsConfig = I18nConfigParams & Pick<GTConfig, 'experimental'>;

const TWINS_CONFIG: TwinsConfig = {
  defaultLocale: 'en',
  locales: ['en', 'fr'],
  experimental: { splitting: 'locale-twins' },
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

/** What the experimental initializeGT* functions do. */
function createCache(
  config: TwinsConfig = TWINS_CONFIG,
  cacheParams: ConstructorParameters<typeof I18nCache>[0] = {}
) {
  initializeI18nConfig(config);
  initializeLocaleTwins(config);
  const cache = new I18nCache(getLocaleTwinCacheParams(cacheParams));
  setI18nCache(cache);
  return cache;
}

async function lookup(locale: string, hash: string) {
  const gt = await getGTInternal({ locale, enableI18n: true });
  return gt('', { $_hash: hash });
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

  it('resolves stripped source-locale content from the registry', async () => {
    register('en', { [GREETING_HASH]: 'Hello {name}' });
    createCache();

    const gt = await getGTInternal({ locale: 'en', enableI18n: true });

    expect(gt('', { name: 'Ada', $_hash: GREETING_HASH })).toBe('Hello Ada');
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

  // The variables come from m(), not msg(): compiled client code has
  // msg('', { $_hash }), server code msg('Welcome, {user}!', { $_hash })
  describe('msg() whose variables m() supplies', () => {
    const WELCOME_FR = 'Bienvenue, {user} !';

    it('renders the twin translation on a locale twin client', async () => {
      register('fr', { [GREETING_HASH]: WELCOME_FR });
      createCache();
      const welcome = msg('', { $_hash: GREETING_HASH });

      const m = await getMessagesInternal({ locale: 'fr', enableI18n: true });

      expect(m(welcome, { user: 'Alice' })).toBe('Bienvenue, Alice !');
    });

    it('renders the same translation on the server', async () => {
      vi.unstubAllGlobals();
      registerLocaleTwin(
        encodeLocaleTwinPlaceholder({ [GREETING_HASH]: 'Welcome, {user}!' })
      );
      const loadTranslations = vi
        .fn()
        .mockResolvedValue({ [GREETING_HASH]: WELCOME_FR });
      createCache(TWINS_CONFIG, { loadTranslations });
      const welcome = msg('Welcome, {user}!', { $_hash: GREETING_HASH });

      const m = await getMessagesInternal({ locale: 'fr', enableI18n: true });

      expect(m(welcome, { user: 'Alice' })).toBe('Bienvenue, Alice !');
    });
  });

  // A custom alias is the twin's locale; formatting uses its mapped code
  it('formats twin content for a custom locale alias with m()', async () => {
    register('fr_CA', {
      [GREETING_HASH]: '{n, plural, one {# bateau} other {# bateaux}}',
    });
    createCache({
      ...TWINS_CONFIG,
      locales: ['en', 'fr_CA'],
      customMapping: { fr_CA: { code: 'fr-CA' } },
    });
    const boats = msg('', { n: 0, $_hash: GREETING_HASH });

    const m = await getMessagesInternal({ locale: 'fr_CA', enableI18n: true });

    expect(m(boats)).toBe('0 bateau');
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

    // Every module the compiler plugin builds calls the registration
    // function, so a lookup without one means the plugin is missing
    it('reports lookups without a hash once when no compiled module ran', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      createCache();

      const gt = await getGTInternal({ locale: 'fr', enableI18n: true });
      gt('Hello');
      gt('Hello');

      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0][0]).toContain('compiler plugin');
    });

    it('does not report lookups without a hash once a compiled module ran', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      registerLocaleTwin();
      createCache();

      const gt = await getGTInternal({ locale: 'fr', enableI18n: true });

      expect(gt('Hello')).toBe('Hello');
      expect(error).not.toHaveBeenCalled();
    });

    it('reports once when twins are registered but twin mode is off', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      register('fr', {
        [GREETING_HASH]: 'Bonjour',
        [SAVE_HASH]: 'Enregistrer',
      });
      createCache({ defaultLocale: 'en', locales: ['en', 'fr'] });

      expect(await lookup('fr', GREETING_HASH)).toBe('Bonjour');
      await lookup('fr', SAVE_HASH);

      const flagOff = warn.mock.calls.filter(([message]) =>
        /gt-i18n.*Warning.*experimental\.splitting/s.test(String(message))
      );
      expect(flagOff).toHaveLength(1);
    });

    it('reports once when the registered twin locale differs from the rendered locale', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      register('fr', {
        [GREETING_HASH]: 'Bonjour',
        [SAVE_HASH]: 'Enregistrer',
      });
      createCache({ ...TWINS_CONFIG, locales: ['en', 'fr', 'es'] });

      await lookup('es', GREETING_HASH);
      await lookup('es', SAVE_HASH);

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toMatch(/"fr".*"es"/s);
    });

    it('stays silent when the flag, the registry and the locale agree', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      register('fr', { [GREETING_HASH]: 'Bonjour' });
      createCache();

      await lookup('fr', GREETING_HASH);

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

  // msg() with a derived $context gets no compiler $_hash: the regular msg()
  // encodes a hash it computed at runtime, which no twin carries
  it('renders a msg() value without a compiler hash as source with m(), on the server and the client', async () => {
    const options = { name: 'Ada', $context: 'greeting' };
    const runtimeHash = hashSource({
      source: 'Hello {name}',
      context: 'greeting',
      dataFormat: 'ICU',
    });
    vi.unstubAllGlobals();
    registerLocaleTwin(encodeLocaleTwinPlaceholder({ [SAVE_HASH]: 'Save' }));
    const loadTranslations = vi
      .fn()
      .mockResolvedValue({ [runtimeHash]: 'Bonjour {name}' });
    createCache(TWINS_CONFIG, { loadTranslations });
    const value = regularMsg('Hello {name}', options);

    const serverM = await getMessagesInternal({
      locale: 'fr',
      enableI18n: true,
    });
    expect(serverM(value)).toBe('Hello Ada');

    resetGTGlobals();
    stubBrowser();
    register('fr', { [SAVE_HASH]: 'Enregistrer' });
    createCache();
    const clientM = await getMessagesInternal({
      locale: 'fr',
      enableI18n: true,
    });
    expect(clientM(value)).toBe('Hello Ada');
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
