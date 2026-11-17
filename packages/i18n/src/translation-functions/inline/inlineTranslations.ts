import type { Content } from '@generaltranslation/format';
import { getI18nConfig } from '../../i18n-config/singleton-operations';
import type { InlineTranslations } from '../../types-dir/inline';

/**
 * The translation embedded at the call site for `locale`, or undefined when
 * `locale` needs no translation or was not embedded. The callback receives the
 * configured spelling of the locale, which is what the compiler embeds under.
 */
export function lookupInlineTranslation<T extends Content>(
  inline: InlineTranslations<T>,
  locale: string
): T | undefined {
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
