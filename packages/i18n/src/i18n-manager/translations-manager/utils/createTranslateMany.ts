import type { Locale } from '../LocalesCache';
import type { TranslateMany } from '../TranslationsCache';

type TranslateManyClient = {
  translateMany(
    sources: Parameters<TranslateMany>[0],
    options: { targetLocale: string },
    timeout?: number
  ): ReturnType<TranslateMany>;
};

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
  gtInstance: TranslateManyClient,
  timeout?: number
): CreateTranslateMany {
  return (locale) => (sources) =>
    gtInstance.translateMany(sources, { targetLocale: locale }, timeout);
}
