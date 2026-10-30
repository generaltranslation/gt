import type { RuntimeTranslateManyOptions } from 'generaltranslation/internal';
import type { Locale } from '../TranslationsCache';
import type { TranslateMany } from '../TranslationsCache';

type TranslateManyClient = {
  translateMany(
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
 * @param getRuntime - Returns the runtime to translate with; called per request, so its errors reject the request
 * @returns The translate many function
 */
export function createTranslateManyFactory(
  getRuntime: () => TranslateManyClient,
  timeout?: number,
  metadata: RuntimeTranslateManyOptions = {}
): CreateTranslateMany {
  return (locale) => async (sources) =>
    getRuntime().translateMany(
      sources,
      { ...metadata, targetLocale: locale },
      timeout
    );
}
