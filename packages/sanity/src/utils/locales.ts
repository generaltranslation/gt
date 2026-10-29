import type { TranslationLocale } from '../types';

/**
 * `locales` is the list of translation *targets*, but configs often repeat the
 * source locale there — spreading `gt.config.json`, which pairs `defaultLocale`
 * with a `locales` array, is the common way to end up with it.
 *
 * A repeated locale is not cosmetic: it reaches
 * `@sanity/document-internationalization` as a duplicate `supportedLanguages`
 * entry, and `sanity-plugin-internationalized-array` then resolves every
 * language after the duplicate to the wrong array index. Its reorder effect
 * rewrites the array, re-renders, and re-flags the same mismatch forever, which
 * crashes the Studio with "Maximum update depth exceeded".
 */
export function resolveTargetLocales(
  sourceLocale: string,
  locales: string[] | undefined
): string[] {
  return Array.from(new Set(locales)).filter(
    (locale) => locale !== sourceLocale
  );
}

/** A locale is selected unless it has been explicitly switched off. */
export function isLocaleSelected(locale: TranslationLocale): boolean {
  return locale.enabled !== false;
}

export function getSelectedLocaleIds(locales: TranslationLocale[]): string[] {
  return locales.filter(isLocaleSelected).map((locale) => locale.localeId);
}

/**
 * Locales whose translation status should be polled: the selected ones, plus
 * any still pending. Deselecting a locale mid-run must not stop it being
 * polled, or its pending marker never clears.
 */
export function getLocaleIdsToPoll(
  locales: TranslationLocale[],
  isPending: (localeId: string) => boolean
): string[] {
  return locales
    .filter((locale) => isLocaleSelected(locale) || isPending(locale.localeId))
    .map((locale) => locale.localeId);
}

export function setLocaleSelected(
  locales: TranslationLocale[],
  localeId: string,
  selected: boolean
): TranslationLocale[] {
  return locales.map((locale) =>
    locale.localeId === localeId ? { ...locale, enabled: selected } : locale
  );
}

/**
 * Selects every target locale, or clears them all when every one is already
 * selected. The source locale is never a target, so it is left untouched.
 */
export function toggleAllLocales(
  locales: TranslationLocale[],
  sourceLocale: string
): TranslationLocale[] {
  const allSelected = locales
    .filter((locale) => locale.localeId !== sourceLocale)
    .every(isLocaleSelected);
  return locales.map((locale) =>
    locale.localeId === sourceLocale
      ? locale
      : { ...locale, enabled: !allSelected }
  );
}

/**
 * The locales a document can be translated into: every locale except the one
 * it is written in.
 */
export function getDocumentTargetLocales(
  locales: TranslationLocale[],
  documentLanguage: string
): TranslationLocale[] {
  return locales.filter((locale) => locale.localeId !== documentLanguage);
}
