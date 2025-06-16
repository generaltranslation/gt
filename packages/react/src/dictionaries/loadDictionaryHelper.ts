import { GT } from 'generaltranslation';
import { dictionaryMissingWarning } from '../errors/createErrors';
import { CustomLoader, Dictionary } from '../types/types';

export default async function loadDictionaryHelper(
  locale: string,
  loadDictionary: CustomLoader
): Promise<Dictionary | undefined> {
  const localeVariants = Array.from(
    new Set([locale, GT.getLocaleProperties(locale).languageCode])
  );
  for (const locale of localeVariants) {
    try {
      const result = await loadDictionary(locale);
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
