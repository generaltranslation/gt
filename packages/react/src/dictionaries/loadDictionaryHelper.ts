import { getLocaleProperties } from 'generaltranslation';
import { dictionaryMissingWarning } from '../errors/createErrors';
import { CustomLoader, Dictionary } from '../types/types';

export default async function loadDictionaryHelper(
  locale: string,
  loadDictionary: CustomLoader
): Promise<Dictionary | undefined> {
  let result: Dictionary | undefined;

  // Check for [locale].json file
  try {
    result = await loadDictionary(locale);
  } catch {}

  // Check the simplified locale name (e.g. 'en' instead of 'en-US')
  const languageCode = getLocaleProperties(locale)?.languageCode;
  if (languageCode && languageCode !== locale) {
    try {
      result = await loadDictionary(languageCode);
    } catch (error) {
      console.warn(dictionaryMissingWarning, error);
    }
  }

  return result;
}
