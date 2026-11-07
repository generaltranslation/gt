import type { Translation } from '../../i18n-cache/translations-manager/utils/types/translation-data';

/**
 * Callback that returns a translation embedded at the call site for a locale.
 *
 * The callback is passed as an extra argument to translation functions such as
 * `gt()`, `t()`, and `<T>` (the `inline` prop). Because the translations live
 * inline at the call site, bundlers drop them along with any unused call
 * site, and a build step can choose which locales to embed. When the callback
 * returns `undefined`, resolution falls back to the loaded translations for
 * that locale.
 *
 * @param {string} locale - The target locale
 * @returns The translation for the locale, or undefined if it was not embedded
 *
 * @example
 * gt('Hello', { $_hash: 'abc' }, (locale) =>
 *   locale === 'fr' ? 'Bonjour' : locale === 'es' ? 'Hola' : undefined
 * );
 */
export type InlineTranslations<T extends Translation = Translation> = (
  locale: string
) => T | undefined;
