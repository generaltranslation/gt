import {
  getLoadTranslationsType,
  LoadTranslationsType,
} from '../i18n-cache/utils/getLoadTranslationsType';
import {
  getTranslationApiType,
  TranslationApiType,
} from '../i18n-cache/utils/getTranslationApiType';

export type GTServicesEnabledParams = {
  projectId?: string;
  devApiKey?: string;
  apiKey?: string;
  cacheUrl?: string | null;
  runtimeUrl?: string | null;
};

declare global {
  interface GeneralTranslationGlobal {
    i18n?: {
      gtServicesEnabled: boolean | undefined;
    };
  }

  var __generaltranslation: GeneralTranslationGlobal | undefined;
}

function getI18nGlobals() {
  globalThis.__generaltranslation ??= {};
  // Add new gt-i18n globals here so this module owns the i18n namespace shape.
  globalThis.__generaltranslation.i18n ??= {
    gtServicesEnabled: undefined,
  };
  return globalThis.__generaltranslation.i18n;
}

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
  return getI18nGlobals().gtServicesEnabled ?? false;
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
  getI18nGlobals().gtServicesEnabled = gtServicesEnabled;
  return gtServicesEnabled;
}
