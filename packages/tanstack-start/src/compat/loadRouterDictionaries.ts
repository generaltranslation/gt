import { getDictionaryManager, getI18nConfig } from 'gt-i18n/internal';
import type { Dictionary } from 'gt-i18n';

/**
 * Dictionary reads only use loaded dictionaries, so the translated one is
 * loaded before render, as gt-next's GTProvider does. Both sides already
 * bundle the source dictionary, which serves the default locale.
 */
export async function loadRouterDictionaries(
  locale: string
): Promise<Record<string, Dictionary>> {
  if (locale === getI18nConfig().getDefaultLocale()) return {};
  const dictionary = await getDictionaryManager().loadDictionary(locale);
  return { [locale]: dictionary };
}
