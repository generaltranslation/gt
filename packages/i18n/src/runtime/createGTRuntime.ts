import { GTRuntime } from 'generaltranslation/runtime';
import type { I18nConfig, I18nConfigParams } from '../i18n-config/I18nConfig';

type GTRuntimeConfig = Pick<
  I18nConfigParams,
  'projectId' | 'runtimeUrl' | 'apiKey' | 'devApiKey'
>;

/** Construct the translation client only inside runtime-translation modules. */
export function createGTRuntime(
  config: I18nConfig,
  runtimeConfig: GTRuntimeConfig
): GTRuntime {
  return new GTRuntime({
    sourceLocale: config.getDefaultLocale(),
    locales: Array.from(
      new Set(
        config
          .getLocales()
          .map((configuredLocale) =>
            config.resolveCanonicalLocale(configuredLocale)
          )
      )
    ),
    customMapping: config.getCustomMapping(),
    projectId: runtimeConfig.projectId,
    baseUrl: runtimeConfig.runtimeUrl || undefined,
    apiKey: runtimeConfig.apiKey,
    devApiKey: runtimeConfig.devApiKey,
  });
}
