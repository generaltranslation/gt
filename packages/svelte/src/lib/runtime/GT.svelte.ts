import { libraryDefaultLocale } from 'generaltranslation/internal';
import type { JsxChildren } from 'generaltranslation/types';
import {
  defaultLocaleCookieName,
  getBrowserCookieValue,
  setBrowserCookieValue,
} from 'gt-i18n/internal/cookies';
import {
  missingLoaderDiagnostic,
  unsupportedLocaleDiagnostic,
} from './diagnostics.js';

/** Translations for one locale, keyed by the hash the plugin computed. */
export type TranslationCatalog = Record<string, string | JsxChildren>;

export type LoadTranslations = (
  locale: string
) => TranslationCatalog | Promise<TranslationCatalog>;

export type CreateGTOptions = {
  defaultLocale?: string;
  locales?: string[];
  /** Wins over the locale cookie; pass the request locale during SSR. */
  locale?: string;
  /** Catalogs that are already loaded, keyed by locale. */
  translations?: Record<string, TranslationCatalog>;
  loadTranslations?: LoadTranslations;
  localeCookieName?: string;
};

/**
 * Locale and catalog state for one app or one server request.
 *
 * The default locale renders source content, so it never loads a catalog.
 */
export class GT {
  readonly defaultLocale: string;
  readonly locales: readonly string[];
  readonly localeCookieName: string;
  #locale = $state('');
  #catalogs = $state.raw<Record<string, TranslationCatalog>>({});
  readonly #loadTranslations: LoadTranslations | undefined;
  readonly #pending = new Map<string, Promise<TranslationCatalog>>();
  #request = 0;

  constructor(options: CreateGTOptions = {}) {
    this.defaultLocale = options.defaultLocale ?? libraryDefaultLocale;
    this.locales = [
      ...new Set([this.defaultLocale, ...(options.locales ?? [])]),
    ];
    this.localeCookieName = options.localeCookieName ?? defaultLocaleCookieName;
    this.#loadTranslations = options.loadTranslations;
    this.#catalogs = { ...options.translations };
    const requested =
      options.locale ?? getBrowserCookieValue(this.localeCookieName);
    this.#locale =
      requested && this.locales.includes(requested)
        ? requested
        : this.defaultLocale;
  }

  get locale(): string {
    return this.#locale;
  }

  getCatalog(locale: string = this.#locale): TranslationCatalog | undefined {
    return this.#catalogs[locale];
  }

  async loadTranslations(locale: string): Promise<TranslationCatalog> {
    if (locale === this.defaultLocale) return {};
    const loaded = this.#catalogs[locale];
    if (loaded) return loaded;
    const pending = this.#pending.get(locale);
    if (pending) return pending;
    const loader = this.#loadTranslations;
    if (!loader) throw new Error(missingLoaderDiagnostic(locale));
    const request = Promise.resolve(loader(locale)).then(
      (catalog) => {
        this.#pending.delete(locale);
        this.#catalogs = { ...this.#catalogs, [locale]: catalog };
        return catalog;
      },
      (error: unknown) => {
        this.#pending.delete(locale);
        throw error;
      }
    );
    this.#pending.set(locale, request);
    return request;
  }

  /** Loads the catalog first, so a failed or superseded switch changes nothing. */
  async setLocale(locale: string): Promise<void> {
    if (!this.locales.includes(locale)) {
      throw new Error(unsupportedLocaleDiagnostic(locale));
    }
    const request = ++this.#request;
    await this.loadTranslations(locale);
    if (request !== this.#request) return;
    this.#locale = locale;
    setBrowserCookieValue(this.localeCookieName, locale);
  }

  /** Lookup target of a compiled `gt()` call. */
  string(hash: string, source: string): string {
    if (this.#locale === this.defaultLocale) return source;
    const translated = this.#catalogs[this.#locale]?.[hash];
    return typeof translated === 'string' ? translated : source;
  }

  /** Lookup target of a compiled `<T>`; `undefined` renders the source. */
  jsx(hash: string): JsxChildren | undefined {
    if (this.#locale === this.defaultLocale) return undefined;
    const translated = this.#catalogs[this.#locale]?.[hash];
    return translated === undefined ? undefined : translated;
  }

  /** Locales a formatter tries, most specific first. */
  formatLocales(explicit: readonly string[] = []): string[] {
    if (this.#locale === this.defaultLocale) return [this.defaultLocale];
    return [...new Set([...explicit, this.#locale, this.defaultLocale])];
  }
}
