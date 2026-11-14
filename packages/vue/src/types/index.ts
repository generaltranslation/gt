import type { Content, JsxChildren } from '@generaltranslation/format';
import type {
  I18nCacheConstructorParams,
  I18nConfigParams,
  LookupOptions,
} from 'gt-i18n/internal';
import type { App, Ref } from 'vue';

/**
 * A hash-keyed locale catalog containing either plain STRING translations or
 * structured rich-content translations consumed by {@link T}.
 */
export type TranslationCatalog = Record<string, JsxChildren>;

/**
 * Loads the complete translation catalog for one locale.
 *
 * Return an empty object when a locale has no catalog. The translation cache
 * set up by `initializeGT()` caches results and deduplicates concurrent
 * requests.
 *
 * @param locale - Locale code requested by the active GT plugin.
 * @returns The locale's translation catalog.
 */
export type LoadTranslations = (locale: string) => Promise<TranslationCatalog>;

/**
 * Options supported by gt-vue plain-string lookups.
 *
 * Plain-string lookups intentionally do not support `$maxChars`, `$format`,
 * ICU syntax, or interpolation variables. Rich {@link T} translations have
 * their own metadata props.
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

/**
 * Options for {@link initializeGT}: the `gt.config.json` keys gt-vue reads,
 * plus the translation loader and cache settings.
 *
 * `defaultLocale` is the source and fallback locale, so translations are
 * never loaded for it. Without `loadTranslations`, translations load from the
 * GT CDN when a `projectId` is configured. `customMapping` aliases apply to
 * locale-sensitive formatting and plural selection; translation loading and
 * persisted locale values keep the alias.
 */
export type InitializeGTOptions = I18nConfigParams & I18nCacheConstructorParams;

/**
 * Options used to create a gt-vue plugin instance. The plugin holds only the
 * active locale; translations live in the cache set up by `initializeGT()`.
 */
export type CreateGTOptions = {
  /**
   * Server-provided or explicit initial locale. It wins over the browser
   * cookie during hydration. When omitted, the cookie wins over
   * `defaultLocale`.
   */
  locale?: string;
  /**
   * Browser cookie used to persist the active locale. Defaults to gt-i18n's
   * `defaultLocaleCookieName`.
   */
  localeCookieName?: string;
};

/**
 * Options used to initialize the browser-only SPA runtime.
 *
 * Unsupported persisted or requested locales fall back to `defaultLocale`.
 * When `locales` is omitted, any locale is accepted.
 */
export type InitializeGTSPAOptions = InitializeGTOptions & CreateGTOptions;

/**
 * Vue plugin returned by {@link createGT} or `initializeGTSPA()`.
 *
 * Install it with `app.use(plugin)`. Its locale is scoped to that plugin
 * instance; translations are shared through the cache set up by
 * `initializeGT()`.
 */
export type GTPlugin = {
  /** Returns the active locale for this plugin instance. */
  getLocale(): string;
  /** Provides the GT state to a Vue application. Usually called by `app.use`. */
  install(app: App): void;
  /**
   * Preloads and caches a locale without changing the active locale. The
   * default locale is already represented by source text and is not loaded.
   */
  loadTranslations(locale: string): Promise<TranslationCatalog>;
  /**
   * Changes the active locale.
   *
   * Plugins from {@link createGT} load the locale before updating reactive
   * consumers. Plugins from `initializeGTSPA()` persist it and reload the
   * document so module-level translations execute again; until that reload,
   * the current page retains the locale it initialized with.
   */
  setLocale(locale: string): Promise<void>;
};

/** @internal Reactive state scoped to one installed plugin instance. */
export type GTState = {
  defaultLocale: string;
  getLocale(): string;
  /**
   * Reactively looks up a translation in the active locale by its hash. In
   * development hot reload, a miss requests the translation of `getSource()`.
   */
  lookupTranslation<T extends Content>(
    options: LookupOptions & { $_hash: string },
    getSource: () => T
  ): T | undefined;
  loadTranslations(locale: string): Promise<TranslationCatalog>;
  /** @internal Resolves aliases for locale-sensitive formatting. */
  resolveFormattingLocale?: (locale: string) => string;
  revision: Ref<number>;
  setLocale(locale: string): Promise<void>;
};
