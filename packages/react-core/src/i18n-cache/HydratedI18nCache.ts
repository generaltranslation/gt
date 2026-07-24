import {
  dedupePending,
  DictionarySourceNotFoundError,
  getI18nConfig,
  getRuntimeEnvironment,
  resolveCacheLocale,
} from 'gt-i18n/internal';
import type { I18nCacheInstance } from 'gt-i18n/internal';
import type {
  I18nCacheConstructorParams,
  LookupOptions,
} from 'gt-i18n/internal/types';
import type { MissingTranslationResolver } from 'gt-i18n/internal/runtime-translation-resolver';
import { SnapshotStore } from 'gt-i18n/internal/snapshot-store';
import { createTranslationLoader } from 'gt-i18n/internal/translation-loader';
import type {
  Dictionary,
  DictionaryEntry,
  DictionaryObject,
  Translation,
} from 'gt-i18n/types';

/** Legacy cache API backed by the lightweight hydrated-client capabilities. */
export class HydratedI18nCache
  implements I18nCacheInstance<Translation>, MissingTranslationResolver
{
  private readonly loadTranslationsFromSource;
  private readonly pendingTranslationLoads = new Map<
    string,
    Promise<Record<string, Translation>>
  >();
  private readonly pendingDictionaryLoads = new Map<
    string,
    Promise<Dictionary>
  >();

  constructor(
    private readonly params: I18nCacheConstructorParams,
    private readonly snapshots: SnapshotStore,
    private readonly missingTranslationResolver?: MissingTranslationResolver
  ) {
    this.loadTranslationsFromSource = createTranslationLoader(params);
  }

  getVersionId(): string | undefined {
    return this.params._versionId;
  }

  updateTranslations(
    translations: Record<string, Record<string, Translation>>
  ): void {
    this.snapshots.updateTranslations(translations);
  }

  updateDictionaries(dictionaries: Record<string, Dictionary>): void {
    this.snapshots.updateDictionaries(dictionaries);
  }

  async loadTranslations(locale: string): Promise<Record<string, Translation>> {
    return this.guardAsync({}, async () => {
      const translationLocale = resolveCacheLocale(locale);
      if (!translationLocale) return {};

      const existing = this.snapshots.getTranslations(translationLocale);
      if (existing) return existing;

      return dedupePending(
        this.pendingTranslationLoads,
        translationLocale,
        async () => {
          const translations =
            await this.loadTranslationsFromSource(translationLocale);
          this.snapshots.updateTranslations({
            [translationLocale]: translations,
          });
          return translations;
        }
      );
    });
  }

  async loadDictionary(locale: string): Promise<Dictionary> {
    return this.guardAsync({}, async () => {
      const dictionaryLocale =
        resolveCacheLocale(locale) ?? getI18nConfig().getDefaultLocale();
      const existing = this.snapshots.getDictionary(dictionaryLocale);
      if (existing) return existing;

      const loadDictionary = this.params.loadDictionary;
      if (!loadDictionary) return {};

      return dedupePending(
        this.pendingDictionaryLoads,
        dictionaryLocale,
        async () => {
          const dictionary = await loadDictionary(dictionaryLocale);
          this.snapshots.updateDictionaries({ [dictionaryLocale]: dictionary });
          return dictionary;
        }
      );
    });
  }

  lookupTranslation<T extends Translation>(
    locale: string,
    message: T,
    options: LookupOptions
  ): T | undefined {
    return this.guard(undefined, () =>
      this.snapshots.lookupTranslation(locale, message, options)
    );
  }

  lookupDictionary(locale: string, id: string): DictionaryEntry | undefined {
    return this.guard(undefined, () =>
      this.snapshots.lookupDictionary(locale, id)
    );
  }

  lookupDictionaryObj(
    locale: string,
    id: string
  ): DictionaryObject | undefined {
    return this.guard(undefined, () =>
      this.snapshots.lookupDictionaryObj(locale, id)
    );
  }

  lookupTranslationWithFallback<T extends Translation>(
    locale: string,
    message: T,
    options: LookupOptions
  ): Promise<T | undefined> {
    const resolver = this.missingTranslationResolver;
    return resolver
      ? this.guardAsync(undefined, () =>
          resolver.lookupTranslationWithFallback(locale, message, options)
        )
      : Promise.resolve(this.lookupTranslation(locale, message, options));
  }

  lookupDictionaryWithFallback(
    locale: string,
    id: string
  ): Promise<DictionaryEntry | undefined> {
    const resolver = this.missingTranslationResolver;
    return resolver
      ? this.guardAsync(undefined, () =>
          resolver.lookupDictionaryWithFallback(locale, id)
        )
      : this.guardAsync(undefined, async () => {
          const targetEntry = this.snapshots.lookupDictionary(locale, id);
          if (targetEntry !== undefined) return targetEntry;

          const sourceEntry = this.snapshots.lookupDictionary(
            getI18nConfig().getDefaultLocale(),
            id
          );
          if (sourceEntry === undefined) {
            throw new DictionarySourceNotFoundError(id);
          }
          return undefined;
        });
  }

  lookupDictionaryObjWithFallback(
    locale: string,
    id: string
  ): Promise<DictionaryObject | undefined> {
    const resolver = this.missingTranslationResolver;
    return resolver
      ? this.guardAsync(undefined, () =>
          resolver.lookupDictionaryObjWithFallback(locale, id)
        )
      : this.guardAsync(undefined, async () => {
          const targetObject = this.snapshots.lookupDictionaryObj(locale, id);
          if (targetObject !== undefined) return targetObject;

          const sourceObject = this.snapshots.lookupDictionaryObj(
            getI18nConfig().getDefaultLocale(),
            id
          );
          if (sourceObject === undefined) {
            throw new DictionarySourceNotFoundError(id);
          }
          return undefined;
        });
  }

  async getLookupTranslation(locale: string) {
    await this.loadTranslations(locale);
    return <T extends Translation>(
      message: T,
      options: LookupOptions = {} as LookupOptions
    ) => this.lookupTranslation(options.$locale ?? locale, message, options);
  }

  async getLookupDictionary(locale: string) {
    await this.loadDictionary(locale);
    return {
      lookupDictionary: (id: string) => this.lookupDictionary(locale, id),
      lookupDictionaryObj: (id: string) => this.lookupDictionaryObj(locale, id),
    };
  }

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

  private handleError(error: unknown): void {
    if (error instanceof DictionarySourceNotFoundError) throw error;
    if (getRuntimeEnvironment() === 'development') throw error;
    console.error(`I18nCache: ${String(error)}`);
  }
}
