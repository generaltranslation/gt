import {
  getLoadTranslationsType,
  LoadTranslationsType,
} from '../i18n-cache/utils/getLoadTranslationsType';
import {
  getTranslationApiType,
  TranslationApiType,
} from '../i18n-cache/utils/getTranslationApiType';
import type { GTServicesSetupParams } from './types';

/**
 * Returns true if GT services are enabled for the given configuration.
 */
export function evaluateGTServicesEnabled(
  config: GTServicesSetupParams
): boolean {
  return (
    getLoadTranslationsType(config) === LoadTranslationsType.GT_REMOTE ||
    getTranslationApiType(config) === TranslationApiType.GT
  );
}
