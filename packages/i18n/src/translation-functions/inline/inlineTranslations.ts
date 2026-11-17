import type { Content } from '@generaltranslation/format';
import type { I18nConfig } from '../../i18n-config/I18nConfig';
import { getI18nConfig } from '../../i18n-config/singleton-operations';
import type { InlineTranslations } from '../../types-dir/inline';

// Every embedded call site asks for the same locale while a page renders, and
// matching it to a configured locale costs more than rendering a message, so
// the last match is kept.
let lastMatch:
  | { config: I18nConfig; locale: string; translationLocale?: string }
  | undefined;

/**
 * The configured spelling of `locale`, which is what the compiler embeds
 * under; undefined when `locale` is invalid, unconfigured or needs no
 * translation.
 */
function getTranslationLocale(locale: string): string | undefined {
  const config = getI18nConfig();
  if (lastMatch?.locale !== locale || lastMatch.config !== config) {
    const translationLocale = config.determineLocale(locale);
    lastMatch = {
      config,
      locale,
      translationLocale:
        translationLocale &&
        config.requiresTranslation({ locale: translationLocale })
          ? translationLocale
          : undefined,
    };
  }
  return lastMatch.translationLocale;
}

/**
 * The translation embedded at the call site for `locale`, or undefined when
 * `locale` needs no translation or was not embedded. The callback receives the
 * configured spelling of the locale, which is what the compiler embeds under.
 */
export function lookupInlineTranslation<T extends Content>(
  inline: InlineTranslations<T>,
  locale: string
): T | undefined {
  // Invalid or unconfigured locales fall through to the cache lookup
  const translationLocale = getTranslationLocale(locale);
  return translationLocale === undefined
    ? undefined
    : inline(translationLocale);
}
