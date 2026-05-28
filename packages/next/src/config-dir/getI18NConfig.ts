import { I18NConfiguration } from './I18NConfiguration';
import { defaultWithGTConfigProps } from './props/defaultWithGTConfigProps';
import {
  devApiKeyIncludedInProductionError,
  noInitGTWarn,
  usingDefaultsWarning,
} from '../errors/createErrors';
import { getDefaultRenderSettings } from 'gt-react/internal';
import { initializeI18nConfig } from 'gt-i18n/internal';

type GlobalWithI18NConfig = typeof globalThis & {
  _GENERALTRANSLATION_I18N_CONFIG_INSTANCE?: I18NConfiguration;
};

export function getI18NConfig(): I18NConfiguration {
  // Return the singleton instance
  const globalObj = globalThis as GlobalWithI18NConfig;
  if (globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE) {
    return globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE;
  }

  // initGT: Get config from environment
  const I18NConfigParams = process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS;
  if (I18NConfigParams) {
    const configParams = {
      ...defaultWithGTConfigProps,
      ...JSON.parse(I18NConfigParams),
    } as ConstructorParameters<typeof I18NConfiguration>[0];
    initializeI18nConfig(configParams);
    globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE = new I18NConfiguration(
      configParams
    );
  } else {
    console.warn(usingDefaultsWarning);
    // no initGT implies:
    //  - not translating at all
    //  - using only default locales

    // Parse: projectId
    const projectId = process.env.GT_PROJECT_ID || '';

    // Parse: apiKey, devApiKey
    let apiKey, devApiKey;
    const envApiKey =
      process.env.GT_DEV_API_KEY || process.env.GT_API_KEY || '';
    const apiKeyType = envApiKey?.split('-')?.[1];
    if (apiKeyType === 'api') {
      apiKey = envApiKey;
    } else if (apiKeyType === 'dev') {
      devApiKey = envApiKey;
    }

    // Parse: defaultLocale
    // Currently, you have to specify the default locale in the config
    const defaultLocale = defaultWithGTConfigProps.defaultLocale;

    // Check: in dev, tell them to use initGT to activate translation
    if (process.env.NODE_ENV === 'development') {
      console.warn(noInitGTWarn);
    }

    // Check: no devApiKey in production
    if (process.env.NODE_ENV === 'production' && devApiKey) {
      throw new Error(devApiKeyIncludedInProductionError);
    }

    // disable all translation
    const configParams = {
      ...defaultWithGTConfigProps,
      locales: [defaultLocale],
      renderSettings: getDefaultRenderSettings(process.env.NODE_ENV),
      apiKey,
      projectId,
      devApiKey,
      runtimeUrl: undefined,
      cacheUrl: null,
      loadTranslationsType: 'disabled',
      loadDictionaryEnabled: false,
    } as ConstructorParameters<typeof I18NConfiguration>[0];
    initializeI18nConfig(configParams);
    globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE = new I18NConfiguration(
      configParams
    );
  }

  return globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE;
}
