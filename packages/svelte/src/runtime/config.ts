import {
  getI18nCache,
  getI18nConfig,
  I18nCache,
  initializeI18nConfig,
  setI18nCache,
} from 'gt-i18n/internal';
import type {
  I18nCacheConstructorParams,
  I18nConfigParams,
} from 'gt-i18n/internal/types';
import type { Content } from '@generaltranslation/format/types';
import { rememberCachedTranslations } from './hydration';

/** Configuration for {@link initializeGT}. */
export type GTSvelteConfig = I18nConfigParams & I18nCacheConstructorParams;

/** Serializable translations for one locale, as returned by {@link loadTranslations}. */
export type GTTranslationsData = {
  locale: string;
  translations: Record<string, Content>;
};

/**
 * Initializes General Translation. Call it once, from a module shared by the
 * server and the browser, before rendering or loading translations.
 *
 * @example
 * ```ts
 * // src/lib/gt.ts
 * import { initializeGT } from 'gt-svelte';
 * import gtConfig from '../../gt.config.json';
 *
 * initializeGT({
 *   ...gtConfig,
 *   loadTranslations: (locale) =>
 *     import(`../_gt/${locale}.json`).then((module) => module.default),
 * });
 * ```
 */
export function initializeGT(config: GTSvelteConfig = {}): void {
  initializeI18nConfig(config);
  setI18nCache(
    new I18nCache<Content>({
      ...config,
      // In the browser, translations usually arrive once, from a load
      // function that client-side navigation does not rerun, so nothing
      // would reload them after they expire. Servers keep the default
      // expiry so long-running processes pick up new translations.
      cacheExpiryTime:
        config.cacheExpiryTime === undefined && typeof window !== 'undefined'
          ? null
          : config.cacheExpiryTime,
    })
  );
}

/**
 * Resolves a requested locale (or list of preferred locales) to a supported
 * locale, falling back to the default locale.
 */
export function resolveLocale(candidates?: string | string[]): string {
  return getI18nConfig().resolveSupportedLocale(candidates);
}

/**
 * Returns the text direction of a locale, for the `dir` attribute. It does
 * not need a component, so it also works on the server, for example in
 * `hooks.server.ts`.
 *
 * @example
 * ```ts
 * getLocaleDirection('ar'); // 'rtl'
 * getLocaleDirection('fr'); // 'ltr'
 * ```
 */
export function getLocaleDirection(locale: string): 'ltr' | 'rtl' {
  return getI18nConfig().getLocaleDirection(locale);
}

/**
 * Loads the translations for a locale so they can be passed to
 * `<GTProvider>`. Run it in a `load` function so server rendering and
 * hydration both have the translations synchronously.
 *
 * @example
 * ```ts
 * // src/routes/+layout.ts
 * import '$lib/gt';
 * import { loadTranslations } from 'gt-svelte';
 *
 * export const load = async () => ({ gt: await loadTranslations('fr') });
 * ```
 */
export async function loadTranslations(
  locale?: string | string[]
): Promise<GTTranslationsData> {
  const resolvedLocale = resolveLocale(locale);
  const translations = await getI18nCache().loadTranslations(resolvedLocale);
  // Lets <GTProvider> skip adding them back to the cache they came from.
  rememberCachedTranslations(resolvedLocale, translations);
  return { locale: resolvedLocale, translations };
}
