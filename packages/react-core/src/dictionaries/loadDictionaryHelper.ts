import { getLocaleProperties } from 'generaltranslation';
import { dictionaryMissingWarning } from '../errors-dir/createErrors';
import { CustomLoader, Dictionary } from '../types-dir/types';

export default async function loadDictionaryHelper(
  locale: string,
  loadDictionary: CustomLoader
): Promise<Dictionary | undefined> {
  const locales = Array.from(
    new Set([locale, getLocaleProperties(locale).languageCode])
  );
  for (const currentLocale of locales) {
    try {
      const result = await loadDictionary(currentLocale);
      if (result) {
        return result;
      }
    } catch {
      /* empty */
    }
  }
  // eslint-disable-next-line no-console
  console.warn(dictionaryMissingWarning);

  return undefined;
}
