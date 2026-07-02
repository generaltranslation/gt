import { TranslationsLoader } from './types';
import logger from '../../../logs/logger';

/**
 * Creates a fallback translations loader function that loads no translations
 * @param warning - Warning logged once on first invocation. Deferred to
 * invocation because translations may be provided externally via
 * updateTranslations() (eg streamed from a server), in which case the loader
 * is never invoked and the warning does not apply.
 * @returns A translations loader function
 */
export function createFallbackTranslationLoader(
  warning?: string
): TranslationsLoader {
  let warned = false;
  const loader: TranslationsLoader = async (_locale: string) => {
    if (warning && !warned) {
      warned = true;
      logger.warn(warning);
    }
    return {};
  };

  return loader;
}
