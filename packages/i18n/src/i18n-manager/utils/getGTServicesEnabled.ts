import {
  getLoadTranslationsType,
  LoadTranslationsType,
} from './getLoadTranslationsType';
import {
  getTranslationApiType,
  TranslationApiType,
} from './getTranslationApiType';

/**
 * Returns true if GT services are enabled
 * @param config - The configuration
 * @returns True if GT services are enabled
 */
export function getGTServicesEnabled(config: {
  cacheUrl?: string | null;
  runtimeUrl?: string | null;
}): boolean {
  return (
    getLoadTranslationsType(config) === LoadTranslationsType.GT_REMOTE ||
    getTranslationApiType(config) === TranslationApiType.GT
  );
}
