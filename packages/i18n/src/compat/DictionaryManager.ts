import logger from '../logs/logger';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { handleCacheError } from '../i18n-cache/utils/handleCacheError';
import { getI18nConfig } from '../i18n-config/singleton-operations';
import { getI18nCache } from '../i18n-cache/singleton-operations';
import { ResourceCache } from '../i18n-cache/translations-manager/ResourceCache';
import type { Locale } from '../i18n-cache/translations-manager/TranslationsCache';
import { DictionaryCache } from './DictionaryCache';
import { resolveDictionaryLookupOptions } from './dictionary-helpers';
import { DictionarySourceNotFoundError } from './DictionarySourceNotFoundError';
import type {
  Dictionary,
  DictionaryConfig,
  DictionaryEntry,
  DictionaryObject,
} from './types';

export type DictionaryManagerParams = DictionaryConfig & {
  /**
   * Locale cache TTL in milliseconds. Undefined uses the default TTL, null
   * disables expiry, and a number sets an explicit TTL.
   */
  cacheExpiryTime?: number | null;
};

type DictionaryResolvers = {
  lookupDictionary: (id: string) => DictionaryEntry | undefined;
  lookupDictionaryObj: (id: string) => DictionaryObject | undefined;
};

/**
 * Locale-keyed dictionary storage for the key-based (compat) API. Dictionary
 * entries without a translation are translated through the I18nCache's public
 * lookupTranslationWithFallback, so they share the translation hash space.
 */
export class DictionaryManager {
  private dictionaries: ResourceCache<Locale, DictionaryCache>;

  constructor(params: DictionaryManagerParams = {}) {
    // loadDictionary requires dictionary so the default locale always has a
    // source dictionary
    if (params.loadDictionary && !params.dictionary) {
      logger.error(
        'DictionaryManager: ' +
          createDiagnosticMessage({
            whatHappened: 'loadDictionary needs a source dictionary',
            fix: 'Provide dictionary so the default locale has source content',
          })
      );
      throw new Error('Validation errors occurred');
    }

    const loadDictionary = params.loadDictionary ?? (() => Promise.resolve({}));
    this.dictionaries = new ResourceCache<Locale, DictionaryCache>({
      ttl: params.cacheExpiryTime,
      load: async (locale) =>
        this.createDictionaryCache(locale, await loadDictionary(locale)),
    });

    // The default locale's source dictionary is provided synchronously and
    // never expires
    const defaultLocale = getI18nConfig().getDefaultLocale();
    this.dictionaries.set(
      defaultLocale,
      this.createDictionaryCache(defaultLocale, params.dictionary ?? {}),
      { expiresAt: -1 }
    );
  }

  private createDictionaryCache(
    locale: Locale,
    init: Dictionary
  ): DictionaryCache {
    return new DictionaryCache({
      init,
      runtimeTranslate: (id, sourceEntry) =>
        this.translateDictionaryEntry(locale, id, sourceEntry),
    });
  }

  updateDictionaries(dictionarySnapshot: Record<Locale, Dictionary>): void {
    for (const locale in dictionarySnapshot) {
      const dictionaryCache = this.dictionaries.get(locale);
      if (dictionaryCache) {
        dictionaryCache.update(dictionarySnapshot[locale]);
      } else {
        this.dictionaries.set(
          locale,
          this.createDictionaryCache(locale, dictionarySnapshot[locale])
        );
      }
    }
  }

  /**
   * Loads in the dictionary for a given locale
   * Edge case usage: access the dictionary object directly
   */
  async loadDictionary(locale: string): Promise<Dictionary> {
    return this.guardAsync({}, async () => {
      const dictionaryLocale = getI18nCache().resolveCacheLocale(locale);
      if (!dictionaryLocale) {
        return this.getDefaultDictionaryCache()?.getInternalCache() ?? {};
      }

      const dictionaryCache =
        await this.dictionaries.getOrLoad(dictionaryLocale);

      return dictionaryCache.getInternalCache();
    });
  }

  /**
   * Look up a dictionary entry
   */
  lookupDictionary(locale: string, id: string): DictionaryEntry | undefined {
    return this.guard(undefined, () =>
      this.dictionaries
        .get(this.resolveDictionaryCacheLocale(locale))
        ?.getEntry(id)
    );
  }

  /**
   * Look up a dictionary entry or subtree
   */
  lookupDictionaryObj(
    locale: string,
    id: string
  ): DictionaryObject | undefined {
    return this.guard(undefined, () =>
      this.dictionaries
        .get(this.resolveDictionaryCacheLocale(locale))
        ?.getValue(id)
    );
  }

  async getLookupDictionary(locale: string): Promise<DictionaryResolvers> {
    return this.guardAsync<DictionaryResolvers>(
      {
        lookupDictionary: () => undefined,
        lookupDictionaryObj: () => undefined,
      },
      async () => {
        const asyncBoundaryLocale = getI18nCache().resolveCacheLocale(locale);
        const asyncBoundaryDictionaryCache = asyncBoundaryLocale
          ? await this.dictionaries.getOrLoad(asyncBoundaryLocale)
          : this.getDefaultDictionaryCache();

        return {
          lookupDictionary: (id) => asyncBoundaryDictionaryCache?.getEntry(id),
          lookupDictionaryObj: (id) =>
            asyncBoundaryDictionaryCache?.getValue(id),
        };
      }
    );
  }

  /**
   * Look up a dictionary entry
   * If it's not found, use the fallback (runtime translate)
   */
  async lookupDictionaryWithFallback(
    locale: string,
    id: string
  ): Promise<DictionaryEntry | undefined> {
    return this.guardAsync(undefined, async () => {
      const dictionaryLocale = getI18nCache().resolveCacheLocale(locale);
      if (!dictionaryLocale) {
        return this.getSourceDictionaryEntry(id);
      }

      const dictionaryCache =
        await this.dictionaries.getOrLoad(dictionaryLocale);

      return (
        dictionaryCache.getEntry(id) ??
        (await dictionaryCache.materializeEntry(
          id,
          this.getSourceDictionaryEntry(id)
        ))
      );
    });
  }

  /**
   * Look up a dictionary entry or subtree
   * If it's not found, use the fallback (runtime translate)
   */
  async lookupDictionaryObjWithFallback(
    locale: string,
    id: string
  ): Promise<DictionaryObject | undefined> {
    return this.guardAsync(undefined, async () => {
      const dictionaryLocale = getI18nCache().resolveCacheLocale(locale);

      if (!dictionaryLocale) {
        return this.getSourceDictionaryObject(id);
      }

      const dictionaryCache =
        await this.dictionaries.getOrLoad(dictionaryLocale);
      const targetObject = dictionaryCache.getValue(id);
      const sourceObject = this.getSourceDictionaryObject(id, {
        throwOnMissing: false,
      });
      if (sourceObject === undefined) {
        if (targetObject !== undefined) {
          return targetObject;
        }
        throw new DictionarySourceNotFoundError(id);
      }

      return await dictionaryCache.materializeValue(
        id,
        sourceObject,
        targetObject
      );
    });
  }

  private async translateDictionaryEntry(
    locale: Locale,
    id: string,
    sourceEntry: DictionaryEntry
  ): Promise<string> {
    const translation = await getI18nCache().lookupTranslationWithFallback(
      locale,
      sourceEntry.entry,
      resolveDictionaryLookupOptions(sourceEntry.options)
    );
    if (typeof translation !== 'string') {
      throw new Error(
        `Dictionary entry "${id}" could not be translated into a string. Check the source entry and translation loader output.`
      );
    }
    return translation;
  }

  private getSourceDictionaryEntry(id: string): DictionaryEntry {
    const sourceEntry = this.getDefaultDictionaryCache()?.getEntry(id);
    if (sourceEntry === undefined) {
      throw new DictionarySourceNotFoundError(id);
    }
    return sourceEntry;
  }

  private getSourceDictionaryObject(
    id: string,
    { throwOnMissing = true }: { throwOnMissing?: boolean } = {}
  ): DictionaryObject | undefined {
    const sourceObject = this.getDefaultDictionaryCache()?.getValue(id);
    if (sourceObject === undefined && throwOnMissing) {
      throw new DictionarySourceNotFoundError(id);
    }
    return sourceObject;
  }

  private getDefaultDictionaryCache() {
    return this.dictionaries.get(getI18nConfig().getDefaultLocale());
  }

  private resolveDictionaryCacheLocale(locale: string): Locale {
    return (
      getI18nCache().resolveCacheLocale(locale) ??
      getI18nConfig().getDefaultLocale()
    );
  }

  // ========== Error Handling ========== //

  /**
   * Same policy as I18nCache (handleCacheError), except that a missing
   * source entry always throws.
   */
  private guard<T>(fallback: T, fn: () => T): T {
    try {
      return fn();
    } catch (error) {
      this.handleError(error);
      return fallback;
    }
  }

  private async guardAsync<T>(fallback: T, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      this.handleError(error);
      return fallback;
    }
  }

  private handleError(error: unknown) {
    if (error instanceof DictionarySourceNotFoundError) {
      throw error;
    }
    handleCacheError('DictionaryManager', error);
  }
}
