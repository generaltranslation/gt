import {
  getLoadTranslationsType,
  LoadTranslationsType,
} from './getLoadTranslationsType';
import {
  getTranslationApiType,
  TranslationApiType,
} from './getTranslationApiType';

export type GTServicesEnabledParams = {
  projectId?: string;
  devApiKey?: string;
  apiKey?: string;
  cacheUrl?: string | null;
  runtimeUrl?: string | null;
};

declare global {
  var __generaltranslation_i18n:
    | {
        gtServicesEnabled: boolean | undefined;
      }
    | undefined;
}

function getI18nGlobals() {
  globalThis.__generaltranslation_i18n ??= {
    gtServicesEnabled: undefined,
  };
  return globalThis.__generaltranslation_i18n;
}

/**
 * Sets whether GT services are enabled.
 * Use this when the value has already been computed outside this runtime.
 */
export function setGTServicesEnabled(gtServicesEnabled: boolean): void {
  getI18nGlobals().gtServicesEnabled = gtServicesEnabled;
}

/**
 * Evaluates and stores whether GT services are enabled.
 * @param config - The configuration
 * @returns True if GT services are enabled
 */
export function setupGTServicesEnabled(
  config: GTServicesEnabledParams = {}
): boolean {
  const gtServicesEnabled =
    getLoadTranslationsType(config) === LoadTranslationsType.GT_REMOTE ||
    getTranslationApiType(config) === TranslationApiType.GT;
  setGTServicesEnabled(gtServicesEnabled);
  return gtServicesEnabled;
}

/**
 * Returns true if GT services are enabled.
 */
export function getGTServicesEnabled(): boolean {
  return getI18nGlobals().gtServicesEnabled ?? false;
}
