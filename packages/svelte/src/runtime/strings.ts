import { decodeOptions } from 'gt-i18n';
import {
  createLookupOptions,
  getI18nCache,
  getI18nConfig,
  interpolateMessage,
} from 'gt-i18n/internal';
import { isEncodedTranslationOptions } from 'gt-i18n/internal/string';
import type {
  GTFunctionType,
  GTTranslationOptions,
  MFunctionType,
} from 'gt-i18n';
import type {
  LocaleProperties,
  StringFormat,
} from '@generaltranslation/format';
import { getLocaleDirection } from './config';
import { getGTState, type GTState } from './state.svelte';

/**
 * Returns a function that translates strings in the active locale. Call it
 * during component initialization; calls in the template update when the
 * locale changes.
 *
 * @example
 * ```svelte
 * <script>
 *   import { useGT } from 'gt-svelte';
 *   const gt = useGT();
 * </script>
 *
 * <input placeholder={gt('Search {count} items', { count })} />
 * ```
 */
export function useGT(): GTFunctionType {
  return createGT(getGTState());
}

/**
 * Returns a function that resolves messages encoded with `msg()`.
 *
 * @example
 * ```svelte
 * <script>
 *   import { msg, useMessages } from 'gt-svelte';
 *   const label = msg('Save');
 *   const m = useMessages();
 * </script>
 *
 * <button>{m(label)}</button>
 * ```
 */
export function useMessages(): MFunctionType {
  const gt = createGT(getGTState());
  return (<T extends string | null | undefined>(
    encodedMsg: T,
    options: GTTranslationOptions = {}
  ) => {
    if (encodedMsg == null) return encodedMsg;
    const decodedOptions = decodeOptions(encodedMsg) ?? {};
    if (isEncodedTranslationOptions(decodedOptions)) {
      return gt(decodedOptions.$_source, decodedOptions);
    }
    return gt(encodedMsg, options);
  }) as MFunctionType;
}

/**
 * Returns the active locale as a reactive `current` property.
 *
 * @example
 * ```svelte
 * <script>
 *   const locale = useLocale();
 * </script>
 *
 * <html lang={locale.current}>
 * ```
 */
export function useLocale(): { readonly current: string } {
  const state = getGTState();
  return {
    get current() {
      return state.locale;
    },
  };
}

/**
 * Returns the text direction, `'ltr'` or `'rtl'`, of `locale` or, by
 * default, of the active locale, as a reactive `current` property. Call it
 * during component initialization; `current` updates when the locale
 * changes.
 *
 * @example
 * ```svelte
 * <script>
 *   const dir = useLocaleDirection();
 * </script>
 *
 * <article dir={dir.current}>...</article>
 * ```
 */
export function useLocaleDirection(locale?: string): {
  readonly current: 'ltr' | 'rtl';
} {
  const state = getGTState();
  return {
    get current() {
      return getLocaleDirection(locale ?? state.locale);
    },
  };
}

/**
 * Returns the properties of `locale` or, by default, of the active locale,
 * such as its `name` and `nativeName`, as a reactive `current` property.
 * Call it during component initialization; `current` updates when the
 * locale changes.
 *
 * @example
 * ```svelte
 * <script>
 *   const properties = useLocaleProperties();
 * </script>
 *
 * <p>{properties.current.nativeName}</p>
 * ```
 */
export function useLocaleProperties(locale?: string): {
  readonly current: LocaleProperties;
} {
  const state = getGTState();
  // Keeps `current` the same object until the locale changes.
  let cached: { locale: string; properties: LocaleProperties } | undefined;
  return {
    get current() {
      const resolvedLocale = locale ?? state.locale;
      if (cached?.locale !== resolvedLocale) {
        cached = {
          locale: resolvedLocale,
          properties: getI18nConfig().getLocaleProperties(resolvedLocale),
        };
      }
      return cached.properties;
    },
  };
}

/**
 * Returns the default locale configured with `initializeGT()`. It does not
 * change, so it can be called anywhere after `initializeGT()`, including on
 * the server.
 */
export function useDefaultLocale(): string {
  return getI18nConfig().getDefaultLocale();
}

/**
 * Returns the supported locales configured with `initializeGT()`, including
 * the default locale. They do not change, so it can be called anywhere after
 * `initializeGT()`, including on the server.
 *
 * @example
 * ```svelte
 * <script>
 *   const locales = useLocales();
 * </script>
 *
 * {#each locales as locale}<option value={locale}>{locale}</option>{/each}
 * ```
 */
export function useLocales(): readonly string[] {
  return getI18nConfig().getLocales();
}

/**
 * Returns a function that switches the locale. The current content stays
 * on screen until the new locale's translations have loaded.
 */
export function useSetLocale(): (locale: string) => Promise<void> {
  const state = getGTState();
  return (locale) => state.setLocale(locale);
}

function createGT(state: GTState): GTFunctionType {
  return (message, options = {}) => {
    // Read the revision so template calls re-run after async cache updates.
    void state.revision;
    const config = getI18nConfig();
    const sourceLocale = config.getDefaultLocale();
    const locale = (options.$locale as string | undefined) ?? state.locale;
    const lookupOptions = createLookupOptions<StringFormat>(
      locale,
      options,
      'ICU'
    );

    let translation: string | undefined;
    if (config.requiresTranslation({ locale })) {
      const cache = getI18nCache();
      translation = cache.lookupTranslation(locale, message, lookupOptions) as
        | string
        | undefined;
    }

    return interpolateMessage({
      source: message,
      target: translation,
      options: lookupOptions,
      sourceLocale,
    });
  };
}
