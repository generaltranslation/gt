import I18NConfiguration from './I18NConfiguration';
import defaultInitGTProps from './props/defaultInitGTProps';
import {
  devApiKeyIncludedInProductionError,
  noInitGTWarn,
  usingDefaultsWarning,
} from '../errors/createErrors';
import { defaultRenderSettings } from 'gt-react/internal';

export default function getI18NConfig(): I18NConfiguration {
  // Return the singleton instance
  const globalObj = globalThis as any;
  if (globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE) {
    return globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE;
  }

  // initGT: Get config from environment
  const I18NConfigParams = process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS;
  if (I18NConfigParams) {
    globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE = new I18NConfiguration({
      ...defaultInitGTProps,
      ...JSON.parse(I18NConfigParams),
    });
  } else {
    console.warn(usingDefaultsWarning);
    // no initGT implies:
    //  - not translating at all
    //  - using only default locales

    // Parse: projectId
    const projectId = process.env.GT_PROJECT_ID || '';

    // Parse: apiKey, devApiKey
    let apiKey, devApiKey;
    const envApiKey = process.env.GT_API_KEY || '';
    const apiKeyType = envApiKey?.split('-')?.[1];
    if (apiKeyType === 'api') {
      apiKey = envApiKey;
    } else if (apiKeyType === 'dev') {
      devApiKey = envApiKey;
    }

    // Parse: defaultLocale
    // Currently, you have to specify the default locale in the config
    const defaultLocale = defaultInitGTProps.defaultLocale;

    // Check: in dev, tell them to use initGT to activate translation
    if (process.env.NODE_ENV === 'development') {
      console.warn(noInitGTWarn);
    }

    // Check: no devApiKey in production
    if (process.env.NODE_ENV === 'production' && devApiKey) {
      throw new Error(devApiKeyIncludedInProductionError);
    }

    // disable all translation
    globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE = new I18NConfiguration({
      ...defaultInitGTProps,
      locales: [defaultLocale],
      renderSettings: defaultRenderSettings,
      apiKey,
      projectId,
      devApiKey,
      runtimeUrl: null,
      cacheUrl: null,
      translationLoaderType: 'disabled',
    });
  }

  return globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE;
}
