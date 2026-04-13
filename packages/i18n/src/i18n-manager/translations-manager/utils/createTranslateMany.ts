import type { Locale } from '../LocalesCache';
import { TranslateMany } from '../_LocaleTranslationCache';
import type { GT } from 'generaltranslation';

/**
 * CreateTranslateMany function type
 */
export type CreateTranslateMany = (locale: Locale) => TranslateMany;

/**
 * Create a translate many function
 * @param locale - The locale
 * @returns The translate many function
 */
export function createTranslateManyFactory(
  gtInstance: GT,
  timeout?: number
): CreateTranslateMany {
  return (locale) => {
    return (sources: Parameters<TranslateMany>[0]) => {
      return gtInstance.translateMany(
        sources,
        { targetLocale: locale },
        timeout
      );
    };
  };
}
