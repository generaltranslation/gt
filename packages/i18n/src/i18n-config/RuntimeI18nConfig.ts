import type { GTRuntime as GTRuntimeType } from 'generaltranslation/runtime';
import { GTRuntime } from 'generaltranslation/runtime';
import {
  getTranslationApiType,
  TranslationApiType,
} from '../i18n-cache/utils/getTranslationApiType';
import {
  getLoadTranslationsType,
  LoadTranslationsType,
} from '../i18n-cache/utils/getLoadTranslationsType';
import {
  getGeneralTranslationLogLevel,
  isDebugLogLevel,
  type GeneralTranslationLogLevel,
} from '../logs/logLevel';
import { getRuntimeEnvironment } from '../utils/getRuntimeEnvironment';
import { I18nConfig, type I18nConfigParams } from './I18nConfig';

type RuntimeConfig = Pick<
  I18nConfigParams,
  'devApiKey' | 'apiKey' | 'runtimeUrl' | '_disableDevHotReload'
>;

export class RuntimeI18nConfig extends I18nConfig {
  protected runtimeConfig: RuntimeConfig;
  private logLevel: GeneralTranslationLogLevel;

  constructor(params: I18nConfigParams = {}) {
    super(params, resolveGTServicesEnabled(params));
    this.runtimeConfig = {
      devApiKey: params.devApiKey,
      apiKey: params.apiKey,
      runtimeUrl: params.runtimeUrl,
      _disableDevHotReload: params._disableDevHotReload,
    };
    this.logLevel = getGeneralTranslationLogLevel();
  }

  getGTClass(locale?: string): GTRuntimeType {
    return new GTRuntime({
      sourceLocale: this.getDefaultLocale(),
      targetLocale: locale ? this.resolveLocale(locale) : undefined,
      locales: Array.from(
        new Set(
          this.getLocales().map((locale) => this.resolveCanonicalLocale(locale))
        )
      ),
      customMapping: this.getCustomMapping(),
      projectId: this.getProjectId(),
      baseUrl: this.runtimeConfig.runtimeUrl || undefined,
      apiKey: this.runtimeConfig.apiKey,
      devApiKey: this.runtimeConfig.devApiKey,
    });
  }

  isDevHotReloadEnabled(): boolean {
    return (
      !this.runtimeConfig._disableDevHotReload &&
      !!this.runtimeConfig.devApiKey &&
      !!this.getProjectId() &&
      this.runtimeConfig.runtimeUrl !== null &&
      this.runtimeConfig.runtimeUrl !== '' &&
      getRuntimeEnvironment() === 'development'
    );
  }

  isDebugLoggingEnabled(): boolean {
    return isDebugLogLevel(this.logLevel);
  }
}

function resolveGTServicesEnabled(config: I18nConfigParams): boolean {
  return (
    getLoadTranslationsType(config) === LoadTranslationsType.GT_REMOTE ||
    getTranslationApiType(config) === TranslationApiType.GT
  );
}
