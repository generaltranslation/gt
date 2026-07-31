import type { JsxChildren } from 'generaltranslation/types';
import type { App, Ref } from 'vue';

/**
 * A hash-keyed locale catalog containing either plain STRING translations or
 * structured rich-content translations consumed by {@link T}.
 */
export type TranslationCatalog = Record<string, JsxChildren>;

/**
 * Loads the complete translation catalog for one locale.
 *
 * Return an empty object when a locale has no catalog. {@link createGT}
 * caches successful results and deduplicates concurrent requests.
 *
 * @param locale - Locale code requested by the active GT plugin.
 * @returns The locale's translation catalog.
 */
export type LoadTranslations = (locale: string) => Promise<TranslationCatalog>;

/**
 * Options supported by gt-vue plain-string lookups.
 *
 * gt-vue intentionally does not support `$maxChars`, `$format`, ICU syntax,
 * or interpolation variables.
 */
export type GTStringOptions = {
  /** Disambiguates identical source strings when calculating their hash. */
  $context?: string;
};

/**
 * Performs a synchronous STRING catalog lookup.
 *
 * @param message - Source string to translate. Braces remain literal.
 * @param options - Optional context used when hashing the source.
 * @returns The translated string, or `message` when no entry exists.
 */
export type GTFunction = (message: string, options?: GTStringOptions) => string;

/**
 * Resolves strings registered by {@link msg}, raw source strings, and nullish
 * values.
 *
 * @param message - Encoded message, raw source string, `null`, or `undefined`.
 * @param options - Optional context for raw source strings. Encoded metadata
 * takes precedence.
 * @returns A translation for string input; nullish input is returned as-is.
 */
export type MessagesFunction = <T extends string | null | undefined>(
  message: T,
  options?: GTStringOptions
) => T extends string ? string : T;

/** Options used to create an isolated gt-vue plugin instance. */
export type CreateGTOptions = {
  /** Source and fallback locale. Defaults to GT's library default locale. */
  defaultLocale?: string;
  /** Async loader called once for each uncached locale. */
  loadTranslations?: LoadTranslations;
  /** Initial active locale. Defaults to `defaultLocale`. */
  locale?: string;
};

/**
 * Vue plugin returned by {@link createGT}.
 *
 * Install it with `app.use(plugin)`. Its locale and catalog cache are scoped
 * to that plugin instance.
 */
export type GTPlugin = {
  /** Returns a non-reactive snapshot of the active locale. */
  getLocale(): string;
  /** Provides the GT state to a Vue application. Usually called by `app.use`. */
  install(app: App): void;
  /** Preloads and caches a locale without changing the active locale. */
  loadTranslations(locale: string): Promise<TranslationCatalog>;
  /**
   * Loads a locale when needed, then switches reactive consumers to it.
   * Only the latest overlapping locale request is applied.
   */
  setLocale(locale: string): Promise<void>;
};

/** @internal Reactive state scoped to one installed plugin instance. */
export type GTState = {
  defaultLocale: string;
  getCatalog(): TranslationCatalog;
  loadTranslations(locale: string): Promise<TranslationCatalog>;
  locale: Ref<string>;
  revision: Ref<number>;
  setLocale(locale: string): Promise<void>;
};
