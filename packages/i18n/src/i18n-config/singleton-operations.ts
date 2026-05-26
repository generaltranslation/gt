import { libraryDefaultLocale } from 'generaltranslation/internal';
import logger from '../logs/logger';
import { getGTServicesEnabled } from '../i18n-cache/utils/getGTServicesEnabled';
import { publishValidationResults } from '../i18n-cache/validation/publishValidationResults';
import { validateLocales } from '../i18n-cache/validation/config-validation/validateLocales';
import {
  I18nConfig,
  standardizeI18nConfigParams,
  type I18nConfigParams,
} from './I18nConfig';

type I18nConfigInitializerParams = I18nConfigParams & {
  projectId?: string;
  devApiKey?: string;
  apiKey?: string;
  cacheUrl?: string | null;
  runtimeUrl?: string | null;
};

let i18nConfig: I18nConfig | undefined = undefined;

export function getI18nConfig(): I18nConfig {
  if (!i18nConfig) {
    logger.warn(
      'getI18nConfig(): I18nConfig was not initialized. Falling back to the default locale until initializeGT() configures locales.'
    );
    i18nConfig = new I18nConfig({
      defaultLocale: libraryDefaultLocale,
      locales: [libraryDefaultLocale],
    });
  }
  return i18nConfig;
}

export function setI18nConfig(nextI18nConfig: I18nConfig): void {
  i18nConfig = nextI18nConfig;
}

export function initializeI18nConfig(
  params: I18nConfigInitializerParams = {}
): I18nConfig {
  publishValidationResults(validateLocales(params), 'I18nConfig: ');

  const nextI18nConfig = new I18nConfig(
    standardizeI18nConfigParams(params, getGTServicesEnabled(params))
  );
  setI18nConfig(nextI18nConfig);
  return nextI18nConfig;
}

export function isI18nConfigInitialized(): boolean {
  return i18nConfig !== undefined;
}
