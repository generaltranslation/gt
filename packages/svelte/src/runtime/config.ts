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
import type { Translation } from 'gt-i18n/types';

/** Configuration for {@link initializeGT}. */
export type GTSvelteConfig = I18nConfigParams & I18nCacheConstructorParams;

/** Serializable translations for one locale, as returned by {@link loadTranslations}. */
export type GTTranslationsData = {
  locale: string;
  translations: Record<string, Translation>;
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
  setI18nCache(new I18nCache<Translation>(config));
}

/**
 * Resolves a requested locale (or list of preferred locales) to a supported
 * locale, falling back to the default locale.
 */
export function resolveLocale(candidates?: string | string[]): string {
  return getI18nConfig().resolveSupportedLocale(candidates);
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
  return { locale: resolvedLocale, translations };
}
