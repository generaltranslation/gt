import type { RuntimeTranslateManyOptions } from 'generaltranslation/internal';
import type { Locale } from '../LocalesCache';
import type { TranslateMany } from '../TranslationsCache';

type RuntimeTranslateMany = {
  (
    sources: Parameters<TranslateMany>[0],
    options: { targetLocale: string } & RuntimeTranslateManyOptions,
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
  translateMany: RuntimeTranslateMany,
  timeout?: number,
  metadata: RuntimeTranslateManyOptions = {}
): CreateTranslateMany {
  return (locale) => (sources) =>
    translateMany(sources, { ...metadata, targetLocale: locale }, timeout);
}
