import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '../../i18n-config/singleton-operations';
import { hashMessage } from '../../utils/hashMessage';
import { createClientI18nRuntime } from '../ClientI18nRuntime';
import { I18nCache } from '../I18nCache';
import { isDictionaryValue } from '../translations-manager/utils/dictionary-helpers';
import type {
  Dictionary,
  I18nCacheConstructorParams,
  I18nRuntime,
} from '../types';
import type { Hash, Locale } from '../translations-manager/TranslationsCache';
import type { Translation } from '../translations-manager/utils/types/translation-data';

type TranslationsSnapshot = Record<Locale, Record<Hash, Translation>>;
type RuntimeHarness = {
  runtime: I18nRuntime;
  getTranslationsSnapshot: (locale: Locale) => Promise<TranslationsSnapshot>;
};

type RuntimeAdapter = {
  name: string;
  create: (config: I18nCacheConstructorParams) => RuntimeHarness;
};

const adapters: RuntimeAdapter[] = [
  {
    name: 'full I18nCache',
    create(config) {
      const cache = new I18nCache(config);
      return {
        runtime: cache,
        async getTranslationsSnapshot(locale) {
          return { [locale]: await cache.loadTranslations(locale) };
        },
      };
    },
  },
  {
    name: 'client I18n runtime',
    create(config) {
      const runtime = createClientI18nRuntime(config);
      return {
        runtime,
        async getTranslationsSnapshot(locale) {
          return { [locale]: await runtime.loadTranslations(locale) };
        },
      };
    },
  },
];

type GlobalWithRegistry = {
  __generaltranslation?: Record<string, unknown>;
};

const lookupOptions = { $format: 'ICU' } as const;
const greetingHash = hashMessage('Hello', lookupOptions);

beforeEach(() => {
  vi.restoreAllMocks();
  const registry = (globalThis as GlobalWithRegistry).__generaltranslation;
  if (!registry) return;
  Reflect.deleteProperty(registry, 'i18n');
  Reflect.deleteProperty(registry, 'reactCore');
});

describe.each(adapters)('$name runtime contract', ({ create }) => {
  function setup(config: I18nCacheConstructorParams = {}): RuntimeHarness {
    const resolvedConfig = {
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      ...config,
    };
    initializeI18nConfig(resolvedConfig);
    return create(resolvedConfig);
  }

  it('does not load translations for the source locale', async () => {
    const loadTranslations = vi.fn(async () => ({
      [greetingHash]: 'Unexpected',
    }));
    const harness = setup({ loadTranslations });

    await expect(harness.getTranslationsSnapshot('en')).resolves.toEqual({
      en: {},
    });
    const lookup = await harness.runtime.getLookupTranslation('en');

    expect(lookup('Hello', lookupOptions)).toBe('Hello');
    expect(loadTranslations).not.toHaveBeenCalled();
  });

  it('exposes the configured version ID', () => {
    const { runtime } = setup({ _versionId: 'version-1' });

    expect(runtime.getVersionId()).toBe('version-1');
  });

  it('deduplicates target-locale loads', async () => {
    const loadTranslations = vi.fn(async () => ({
      [greetingHash]: 'Bonjour',
    }));
    const { runtime } = setup({ loadTranslations });

    const [first, second] = await Promise.all([
      runtime.getLookupTranslation('fr'),
      runtime.getLookupTranslation('fr'),
    ]);

    expect(first('Hello', lookupOptions)).toBe('Bonjour');
    expect(second('Hello', lookupOptions)).toBe('Bonjour');
    expect(loadTranslations).toHaveBeenCalledTimes(1);
    expect(loadTranslations).toHaveBeenCalledWith('fr');
  });

  it('exposes loaded resources through synchronous lookups', async () => {
    const { runtime } = setup({
      dictionary: { greeting: 'Hello' },
      loadTranslations: async () => ({ [greetingHash]: 'Bonjour' }),
      loadDictionary: async () => ({ greeting: 'Bonjour' }),
    });

    await Promise.all([
      runtime.loadTranslations('fr'),
      runtime.loadDictionary('fr'),
    ]);

    expect(runtime.lookupTranslation('fr', 'Hello', lookupOptions)).toBe(
      'Bonjour'
    );
    expect(runtime.lookupDictionary('fr', 'greeting')?.entry).toBe('Bonjour');
    expect(runtime.lookupDictionaryObj('fr', 'greeting')).toBe('Bonjour');
  });

  it('returns isolated translation snapshots', async () => {
    const harness = setup({
      loadTranslations: async () => ({ [greetingHash]: 'Bonjour' }),
    });

    const snapshot = await harness.getTranslationsSnapshot('fr');
    snapshot.fr[greetingHash] = 'Mutated';

    await expect(harness.getTranslationsSnapshot('fr')).resolves.toEqual({
      fr: { [greetingHash]: 'Bonjour' },
    });
  });

  it('shares canonical and configured alias loads', async () => {
    const loadTranslations = vi.fn(async () => ({
      [greetingHash]: 'Bonjour',
    }));
    const { runtime } = setup({
      locales: ['en', 'brand-french'],
      customMapping: {
        'brand-french': { code: 'fr', name: 'Brand French' },
      },
      loadTranslations,
    });

    const [aliasLookup, canonicalLookup] = await Promise.all([
      runtime.getLookupTranslation('brand-french'),
      runtime.getLookupTranslation('fr'),
    ]);

    expect(aliasLookup('Hello', lookupOptions)).toBe('Bonjour');
    expect(canonicalLookup('Hello', lookupOptions)).toBe('Bonjour');
    expect(loadTranslations).toHaveBeenCalledTimes(1);
    expect(loadTranslations).toHaveBeenCalledWith('brand-french');
  });

  it('expires loaded catalogs without changing existing resolvers', async () => {
    let loadCount = 0;
    const { runtime } = setup({
      cacheExpiryTime: 0,
      loadTranslations: async () => ({
        [greetingHash]: `Bonjour ${++loadCount}`,
      }),
    });

    const first = await runtime.getLookupTranslation('fr');
    const second = await runtime.getLookupTranslation('fr');

    expect(first('Hello', lookupOptions)).toBe('Bonjour 1');
    expect(second('Hello', lookupOptions)).toBe('Bonjour 2');
    expect(first('Hello', lookupOptions)).toBe('Bonjour 1');
    expect(loadCount).toBe(2);
  });

  it('retries failed translation loads', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let loadCount = 0;
    const { runtime } = setup({
      loadTranslations: async () => {
        if (++loadCount === 1) throw new Error('temporary failure');
        return { [greetingHash]: 'Bonjour' };
      },
    });

    const first = await runtime.getLookupTranslation('fr');
    const second = await runtime.getLookupTranslation('fr');

    expect(first('Hello', lookupOptions)).toBe('Hello');
    expect(second('Hello', lookupOptions)).toBe('Bonjour');
    expect(loadCount).toBe(2);
  });

  it('retains loader state across expired loads', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { runtime } = setup({ cacheExpiryTime: 0 });

    await runtime.getLookupTranslation('fr');
    await runtime.getLookupTranslation('fr');

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('returns isolated dictionary objects', async () => {
    const harness = setup({
      dictionary: { navigation: { about: 'About' } },
    });
    const dictionaryLookup = await harness.runtime.getLookupDictionary('en');
    const navigation = dictionaryLookup.lookupDictionaryObj('navigation');
    if (!isDictionaryValue(navigation)) {
      throw new Error('Expected a navigation dictionary object');
    }
    navigation.about = 'Mutated';

    expect(dictionaryLookup.lookupDictionaryObj('navigation')).toEqual({
      about: 'About',
    });
  });

  it('rejects unsafe dictionary paths without throwing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { runtime } = setup({ dictionary: { greeting: 'Hello' } });
    await runtime.loadDictionary('en');

    expect(runtime.lookupDictionaryObj('en', '__proto__.polluted')).toBe(
      undefined
    );
  });

  it('isolates the configured source dictionary', async () => {
    const dictionary: Dictionary = {
      navigation: { about: 'About' },
    };
    const harness = setup({ dictionary });
    const dictionaryLookup = await harness.runtime.getLookupDictionary('en');
    const navigation = dictionary.navigation;
    if (!isDictionaryValue(navigation)) {
      throw new Error('Expected a navigation dictionary object');
    }
    navigation.about = 'Mutated';

    expect(dictionaryLookup.lookupDictionaryObj('navigation')).toEqual({
      about: 'About',
    });
  });

  it('deduplicates target-locale dictionary loads', async () => {
    const loadDictionary = vi.fn(async () => ({ greeting: 'Bonjour' }));
    const { runtime } = setup({
      dictionary: { greeting: 'Hello' },
      loadDictionary,
    });

    const [first, second] = await Promise.all([
      runtime.getLookupDictionary('fr'),
      runtime.getLookupDictionary('fr'),
    ]);

    expect(first.lookupDictionary('greeting')?.entry).toBe('Bonjour');
    expect(second.lookupDictionary('greeting')?.entry).toBe('Bonjour');
    expect(loadDictionary).toHaveBeenCalledTimes(1);
    expect(loadDictionary).toHaveBeenCalledWith('fr');
  });

  it('does not load the source dictionary', async () => {
    const loadDictionary = vi.fn(async () => ({ greeting: 'Unexpected' }));
    const { runtime } = setup({
      dictionary: { greeting: 'Hello' },
      loadDictionary,
    });

    const lookup = await runtime.getLookupDictionary('en');

    expect(lookup.lookupDictionary('greeting')?.entry).toBe('Hello');
    expect(loadDictionary).not.toHaveBeenCalled();
  });

  it('uses the source dictionary for source-language dialects', async () => {
    const loadDictionary = vi.fn(async () => ({ greeting: 'Unexpected' }));
    const { runtime } = setup({
      locales: ['en', 'en-US', 'fr'],
      dictionary: { greeting: 'Hello' },
      loadDictionary,
    });

    await expect(runtime.loadDictionary('en-US')).resolves.toEqual({
      greeting: 'Hello',
    });
    expect(runtime.lookupDictionary('en-US', 'greeting')?.entry).toBe('Hello');
    const lookup = await runtime.getLookupDictionary('en-US');
    expect(lookup.lookupDictionary('greeting')?.entry).toBe('Hello');
    expect(loadDictionary).not.toHaveBeenCalled();
  });

  it('shares canonical and configured alias dictionary loads', async () => {
    const loadDictionary = vi.fn(async () => ({ greeting: 'Bonjour' }));
    const { runtime } = setup({
      locales: ['en', 'brand-french'],
      customMapping: {
        'brand-french': { code: 'fr', name: 'Brand French' },
      },
      dictionary: { greeting: 'Hello' },
      loadDictionary,
    });

    const [aliasLookup, canonicalLookup] = await Promise.all([
      runtime.getLookupDictionary('brand-french'),
      runtime.getLookupDictionary('fr'),
    ]);

    expect(aliasLookup.lookupDictionary('greeting')?.entry).toBe('Bonjour');
    expect(canonicalLookup.lookupDictionary('greeting')?.entry).toBe('Bonjour');
    expect(loadDictionary).toHaveBeenCalledTimes(1);
    expect(loadDictionary).toHaveBeenCalledWith('brand-french');
  });

  it('expires loaded dictionaries without changing existing resolvers', async () => {
    let loadCount = 0;
    const { runtime } = setup({
      cacheExpiryTime: 0,
      dictionary: { greeting: 'Hello' },
      loadDictionary: async () => ({
        greeting: `Bonjour ${++loadCount}`,
      }),
    });

    const first = await runtime.getLookupDictionary('fr');
    const second = await runtime.getLookupDictionary('fr');

    expect(first.lookupDictionary('greeting')?.entry).toBe('Bonjour 1');
    expect(second.lookupDictionary('greeting')?.entry).toBe('Bonjour 2');
    expect(first.lookupDictionary('greeting')?.entry).toBe('Bonjour 1');
    expect(loadCount).toBe(2);
  });

  it('retries failed dictionary loads', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let loadCount = 0;
    const { runtime } = setup({
      dictionary: { greeting: 'Hello' },
      loadDictionary: async () => {
        if (++loadCount === 1) throw new Error('temporary failure');
        return { greeting: 'Bonjour' };
      },
    });

    const first = await runtime.getLookupDictionary('fr');
    const second = await runtime.getLookupDictionary('fr');

    expect(first.lookupDictionary('greeting')).toBeUndefined();
    expect(second.lookupDictionary('greeting')?.entry).toBe('Bonjour');
    expect(loadCount).toBe(2);
  });

  it('uses loaded alternate locales in bound translation resolvers', async () => {
    const { runtime } = setup({
      locales: ['en', 'fr', 'de'],
      loadTranslations: async (locale) => ({
        [greetingHash]: locale === 'fr' ? 'Bonjour' : 'Hallo',
      }),
    });
    await runtime.loadTranslations('de');

    const lookup = await runtime.getLookupTranslation('fr');

    expect(lookup('Hello', { ...lookupOptions, $locale: 'de' })).toBe('Hallo');
  });

  it('validates dictionary loaders at initialization', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => setup({ loadDictionary: async () => ({}) })).toThrow(
      'Validation errors occurred'
    );
  });

  it('falls back without loading for invalid locales', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const loadTranslations = vi.fn(async () => ({
      [greetingHash]: 'Unexpected',
    }));
    const { runtime } = setup({ loadTranslations });

    const lookup = await runtime.getLookupTranslation('not-configured');

    expect(lookup('Hello', lookupOptions)).toBe('Hello');
    expect(
      runtime.lookupTranslation('not-configured', 'Hello', lookupOptions)
    ).toBeUndefined();
    expect(loadTranslations).not.toHaveBeenCalled();
  });
});
