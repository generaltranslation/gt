import { GTRuntime } from 'generaltranslation/runtime';
import {
  getGeneralTranslationLogLevel,
  isDebugLogLevel,
} from '../logs/logLevel';
import { getRuntimeEnvironment } from '../utils/getRuntimeEnvironment';
import { I18nConfig, type I18nConfigParams } from './I18nConfig';

type RuntimeConfig = Pick<
  I18nConfigParams,
  'apiKey' | 'devApiKey' | 'runtimeUrl' | '_disableDevHotReload'
>;

export class RuntimeI18nConfig extends I18nConfig {
  private logLevel = getGeneralTranslationLogLevel();
  private runtimeConfig: RuntimeConfig;

  constructor(params: I18nConfigParams = {}) {
    super(params);
    this.runtimeConfig = {
      apiKey: params.apiKey,
      devApiKey: params.devApiKey,
      runtimeUrl: params.runtimeUrl,
      _disableDevHotReload: params._disableDevHotReload,
    };
  }

  getGTClass(locale?: string): GTRuntime {
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
