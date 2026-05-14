import { getLocaleProperties } from '@generaltranslation/format';
import { customLoadDictionaryWarning } from '../errors-dir/createErrors';
import { CustomLoader, Dictionary } from '../types-dir/types';

export async function loadDictionaryHelper(
  locale: string,
  loadDictionary: CustomLoader
): Promise<Dictionary | undefined> {
  for (const currentLocale of getDictionaryLoaderLocales(locale)) {
    try {
      const result = await loadDictionary(currentLocale);
      if (result) {
        return result as Dictionary;
      }
    } catch {
      // Try the next locale candidate.
    }
  }

  console.warn(customLoadDictionaryWarning(locale));
  return undefined;
}

function getDictionaryLoaderLocales(locale: string): string[] {
  try {
    const { languageCode } = getLocaleProperties(locale);
    return languageCode === locale ? [locale] : [locale, languageCode];
  } catch {
    return [locale];
  }
}
