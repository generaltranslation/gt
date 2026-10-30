import type { I18nCache } from '../../i18n-cache/I18nCache';
import { setI18nCache } from '../../i18n-cache/singleton-operations';
import { DictionaryManager } from '../DictionaryManager';
import type { Dictionary, DictionaryLoader } from '../types';

/**
 * Registers the I18nCache singleton the DictionaryManager composes on, then
 * exposes both through one object so dictionary tests can drive translations
 * and dictionaries the way they did when both lived on I18nCache.
 */
export function createDictionaryHarness<Cache extends I18nCache>(
  cache: Cache,
  {
    dictionary,
    loadDictionary,
    cacheExpiryTime,
  }: {
    dictionary?: unknown;
    loadDictionary?: unknown;
    cacheExpiryTime?: unknown;
  } = {}
): DictionaryManager & Cache {
  setI18nCache(cache);
  const manager = new DictionaryManager({
    dictionary: dictionary as Dictionary | undefined,
    loadDictionary: loadDictionary as DictionaryLoader | undefined,
    cacheExpiryTime: cacheExpiryTime as number | null | undefined,
  });
  return new Proxy(manager, {
    get(target, property) {
      const owner: object = property in target ? target : cache;
      const value = Reflect.get(owner, property);
      return typeof value === 'function' ? value.bind(owner) : value;
    },
  }) as DictionaryManager & Cache;
}
