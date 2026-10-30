import { getI18nConfig } from 'gt-i18n/internal';
import { getDictionaryManager, type Dictionary } from 'gt-i18n/internal/compat';

export type GTDictionaries = Record<string, Dictionary>;

/**
 * The locale's dictionary, keyed by locale. Both sides bundle the source
 * dictionary, which serves the default locale, so it is never included.
 */
export async function loadDictionaries(
  locale: string
): Promise<GTDictionaries> {
  if (locale === getI18nConfig().getDefaultLocale()) return {};
  return { [locale]: await getDictionaryManager().loadDictionary(locale) };
}
