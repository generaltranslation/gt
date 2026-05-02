import { TranslationsLoader } from './types';

/**
 * Creates a fallback translations loader function that loads translations from a fallback source
 * @returns A translations loader function
 */
export function createFallbackTranslationLoader(): TranslationsLoader {
  const loader: TranslationsLoader = async (_locale: string) => {
    return {};
  };

  return loader;
}
