/**
 * How a rendering lookup resolves with locale twins on: the registered twin
 * entry, the source text (content no twin carries, in production builds), or
 * the usual translation path (dev builds).
 */
import { encodeLocaleTwinPlaceholder } from 'generaltranslation/internal/experimental';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GTConfig } from 'generaltranslation/types';
import { I18nCache } from '../../../i18n-cache/I18nCache';
import { initializeI18nConfig } from '../../../i18n-config/singleton-operations';
import type { I18nConfigParams } from '../../../i18n-config/I18nConfig';
import { setI18nCache } from '../../../i18n-cache/singleton-operations';
import { registerLocaleTwin } from '../registry';
import {
  getLocaleTwinCacheParams,
  initializeLocaleTwins,
  resolveLocaleTwinLookup,
} from '../runtime';

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };

const ATTRIBUTED_HASH = '0123456789abcdef';
const RUNTIME_HASH = 'fedcba9876543210';

type TwinsConfig = I18nConfigParams & Pick<GTConfig, 'experimental'>;

const TWINS_CONFIG: TwinsConfig = {
  defaultLocale: 'en',
  locales: ['en', 'fr'],
  experimental: { splitting: 'locale-twins' },
};

function register(locale: string, entries: Record<string, unknown>) {
  return registerLocaleTwin(JSON.stringify({ l: locale, e: entries }));
}

/**
 * What a server bundle (or an original chunk) does: register an unfilled
 * placeholder, which records compiled code but registers no table.
 */
function registerUnfilled() {
  return registerLocaleTwin(
    encodeLocaleTwinPlaceholder({ [ATTRIBUTED_HASH]: 'Hello' })
  );
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

function stubBrowser() {
  vi.stubGlobal('window', globalThis);
  vi.stubGlobal('document', {});
}

describe('resolveLocaleTwinLookup', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns the registered entry for a hashed lookup', () => {
    register('fr', { [ATTRIBUTED_HASH]: 'Bonjour' });
    createCache();

    expect(
      resolveLocaleTwinLookup(
        'fr',
        { $_hash: ATTRIBUTED_HASH },
        ATTRIBUTED_HASH
      )
    ).toEqual({
      entry: 'Bonjour',
      rendersSource: false,
      sourceFallback: false,
    });
  });

  it('marks a source fallback (a translation missing from the twin)', () => {
    registerLocaleTwin(
      JSON.stringify({
        l: 'fr',
        e: { [ATTRIBUTED_HASH]: 'Hello', [RUNTIME_HASH]: 'Bonjour' },
        s: [ATTRIBUTED_HASH],
      })
    );
    createCache();

    expect(
      resolveLocaleTwinLookup(
        'fr',
        { $_hash: ATTRIBUTED_HASH },
        ATTRIBUTED_HASH
      )
    ).toEqual({ entry: 'Hello', rendersSource: false, sourceFallback: true });
    expect(
      resolveLocaleTwinLookup('fr', { $_hash: RUNTIME_HASH }, RUNTIME_HASH)
    ).toEqual({
      entry: 'Bonjour',
      rendersSource: false,
      sourceFallback: false,
    });
  });

  it('renders content without a compile-time hash as source in production', () => {
    registerUnfilled();
    createCache();

    expect(resolveLocaleTwinLookup('fr', {}, undefined).rendersSource).toBe(
      true
    );
    // A hash computed at runtime is not a compile-time hash
    expect(
      resolveLocaleTwinLookup('fr', { $_hash: RUNTIME_HASH }, undefined)
        .rendersSource
    ).toBe(true);
    expect(
      resolveLocaleTwinLookup(
        'fr',
        { $_hash: ATTRIBUTED_HASH },
        ATTRIBUTED_HASH
      ).rendersSource
    ).toBe(false);
  });

  it('renders unattributed content as source once a module without attributed entries ran', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    // What the compiler emits in a module without attributed entries
    expect(registerLocaleTwin()).toBe(false);
    createCache();

    expect(resolveLocaleTwinLookup('fr', {}, undefined).rendersSource).toBe(
      true
    );
    expect(error).not.toHaveBeenCalled();
  });

  it('translates unattributed content as usual in dev builds', () => {
    vi.stubEnv('NODE_ENV', 'development');
    registerUnfilled();
    createCache();

    expect(resolveLocaleTwinLookup('fr', {}, undefined).rendersSource).toBe(
      false
    );
  });

  it('never renders source with locale splitting', () => {
    registerUnfilled();
    createCache({ defaultLocale: 'en', locales: ['en', 'fr'] });

    expect(resolveLocaleTwinLookup('fr', {}, undefined).rendersSource).toBe(
      false
    );
  });

  describe('on a locale twin client', () => {
    beforeEach(stubBrowser);

    it('reports once when nothing registered a twin (compiler plugin missing)', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      createCache();

      // No compiled module ran: translate as usual
      expect(resolveLocaleTwinLookup('fr', {}, undefined)).toEqual({
        entry: undefined,
        rendersSource: false,
        sourceFallback: false,
      });
      resolveLocaleTwinLookup('fr', { $_hash: ATTRIBUTED_HASH }, undefined);

      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0][0]).toMatch(
        /gt-i18n.*Error.*no locale twin was registered.*compiler plugin/s
      );
    });

    it('reports once when only unfilled placeholders registered (original chunks served)', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      registerUnfilled();
      createCache();

      expect(resolveLocaleTwinLookup('fr', {}, undefined).rendersSource).toBe(
        true
      );
      resolveLocaleTwinLookup('fr', {}, undefined);

      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0][0]).toMatch(
        /gt-i18n.*Error.*no locale twin was registered.*original client chunks/s
      );
    });

    it('does not report a page whose modules have no attributed entries', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      registerLocaleTwin();
      createCache();

      expect(resolveLocaleTwinLookup('fr', {}, undefined).rendersSource).toBe(
        true
      );
      expect(error).not.toHaveBeenCalled();
    });

    it('does not report unattributed content next to registered twins', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      register('fr', { [ATTRIBUTED_HASH]: 'Bonjour' });
      createCache();

      expect(resolveLocaleTwinLookup('fr', {}, undefined).rendersSource).toBe(
        true
      );
      expect(error).not.toHaveBeenCalled();
    });
  });
});

describe('dictionaries on a locale twin client', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    stubBrowser();
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
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
