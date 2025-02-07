import I18NConfiguration from './I18NConfiguration';
import defaultInitGTProps from './props/defaultInitGTProps';
import {
  APIKeyMissingError,
  devApiKeyIncludedInProductionError,
  projectIdMissingError,
  usingDefaultsWarning,
} from '../errors/createErrors';
import { defaultRenderSettings } from 'gt-react/internal';

export default function getI18NConfig(): I18NConfiguration {
  const globalObj = globalThis as any;

  // Return the instance if it already exists (singleton)
  if (globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE) {
    return globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE;
  }

  // Get config from environment
  const I18NConfigParams = process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS;

  if (I18NConfigParams) {
    globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE = new I18NConfiguration({
      ...defaultInitGTProps,
      ...JSON.parse(I18NConfigParams),
    });
  } else {
    console.warn(usingDefaultsWarning);

    const projectId = process.env.GT_PROJECT_ID || '';
    if (!projectId) {
      if (process.env.NODE_ENV === 'development') {
        throw new Error(projectIdMissingError);
      } else {
        console.warn(projectIdMissingError);
      }
    }

    let apiKey, devApiKey;
    const envApiKey = process.env.GT_API_KEY || '';
    const apiKeyType = envApiKey?.split('-')?.[1];
    if (apiKeyType === 'api') {
      apiKey = envApiKey;
    } else if (apiKeyType === 'dev') {
      devApiKey = envApiKey;
    }

    const environment = process.env.NODE_ENV;
    if (environment === 'production' && devApiKey) {
      throw new Error(devApiKeyIncludedInProductionError);
    }

    if (!apiKey && !devApiKey) console.error(APIKeyMissingError);

    globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE = new I18NConfiguration({
      ...defaultInitGTProps,
      renderSettings: defaultRenderSettings,
      apiKey,
      projectId,
      devApiKey,
    });
  }

  return globalObj._GENERALTRANSLATION_I18N_CONFIG_INSTANCE;
}
