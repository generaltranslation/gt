import type { Content } from '@generaltranslation/format';

/**
 * Callback that returns a translation embedded at the call site for a locale.
 *
 * Because the translations live inline at the call site, bundlers drop them
 * along with any unused call site, and a build step can choose which locales
 * to embed. When the callback returns `undefined`, resolution falls back to
 * the loaded translations for that locale.
 *
 * @param {string} locale - The target locale
 * @returns The translation for the locale, or undefined if it was not embedded
 *
 * @example
 * gt({ inline: (locale) => (locale === 'fr' ? 'Bonjour' : undefined) })`Hello`;
 */
export type InlineTranslations<T extends Content = Content> = (
  locale: string
) => T | undefined;

/**
 * The `inline` option, shared by `<T>` (as a prop) and the `gt` and `t` from
 * `/unstable` (in their options). Only gt-react based runtimes embed
 * translations for now; gt-i18n owns the type because its unstable runtime
 * reads the option.
 */
export type InlineTranslationsOption<T extends Content = Content> = {
  /**
   * Translations embedded at the call site, usually injected at build time.
   * Only called when the locale needs translation; returning undefined falls
   * back to loaded translations.
   */
  inline?: InlineTranslations<T>;
};
