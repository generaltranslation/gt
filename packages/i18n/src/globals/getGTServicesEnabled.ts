import {
  getLoadTranslationsType,
  LoadTranslationsType,
} from '../i18n-cache/utils/getLoadTranslationsType';
import {
  getTranslationApiType,
  TranslationApiType,
} from '../i18n-cache/utils/getTranslationApiType';
import { createGlobalSingleton } from './createGlobalSingleton';

export type GTServicesEnabledParams = {
  projectId?: string;
  devApiKey?: string;
  apiKey?: string;
  cacheUrl?: string | null;
  runtimeUrl?: string | null;
};

const gtServicesEnabledSingleton = createGlobalSingleton<boolean>({
  namespace: 'i18n',
  key: 'gtServicesEnabled',
  source: 'gt-i18n',
  notInitialized: () => 'GT services enabled flag has not been initialized.',
});

function resolveGTServicesEnabled(config: GTServicesEnabledParams): boolean {
  return (
    getLoadTranslationsType(config) === LoadTranslationsType.GT_REMOTE ||
    getTranslationApiType(config) === TranslationApiType.GT
  );
}

/**
 * Returns true if GT services are enabled.
 */
export function getGTServicesEnabled(): boolean {
  return gtServicesEnabledSingleton.isInitialized()
    ? gtServicesEnabledSingleton.get()
    : false;
}

/**
 * Evaluates and stores whether GT services are enabled.
 * @param config - The configuration
 * @returns True if GT services are enabled
 */
export function setupGTServicesEnabled(
  config: GTServicesEnabledParams = {}
): boolean {
  const gtServicesEnabled = resolveGTServicesEnabled(config);
  gtServicesEnabledSingleton.set(gtServicesEnabled);
  return gtServicesEnabled;
}
