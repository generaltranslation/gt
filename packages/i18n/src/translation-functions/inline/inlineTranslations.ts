import type { Content } from '@generaltranslation/format';
import { getI18nConfig } from '../../i18n-config/singleton-operations';

/**
 * Callback that returns a translation embedded at the call site for a locale.
 *
 * The callback is passed to `<T>` as the `inline` prop, and to the `gt` and
 * `t` from `/unstable` as the `$_inline` option. Because the translations live
 * inline at the call site, bundlers drop them along with any unused call
 * site, and a build step can choose which locales to embed. When the callback
 * returns `undefined`, resolution falls back to the loaded translations for
 * that locale.
 *
 * @param {string} locale - The target locale
 * @returns The translation for the locale, or undefined if it was not embedded
 *
 * @example
 * gt({ $_inline: (locale) => (locale === 'fr' ? 'Bonjour' : undefined) })`Hello`;
 */
export type InlineTranslations<T extends Content = Content> = (
  locale: string
) => T | undefined;

/**
 * The translation embedded at the call site for `locale`, or undefined when
 * `locale` needs no translation or was not embedded. The callback receives the
 * configured spelling of the locale, which is what the compiler embeds under.
 */
export function lookupInlineTranslation<T extends Content>(
  inline: InlineTranslations<T> | undefined,
  locale: string
): T | undefined {
  if (!inline) return undefined;
  const i18nConfig = getI18nConfig();
  // Invalid or unconfigured locales fall through to the cache lookup
  const translationLocale = i18nConfig.determineLocale(locale);
  if (
    !translationLocale ||
    !i18nConfig.requiresTranslation({ locale: translationLocale })
  ) {
    return undefined;
  }
  return inline(translationLocale);
}
