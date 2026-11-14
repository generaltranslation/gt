import type { LocaleConfig, CustomMapping } from '@generaltranslation/format';
import { GTRuntime } from 'generaltranslation/runtime';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { GTIntl } from 'generaltranslation/internal';
import { defaultDefaultLocale } from '@generaltranslation/format/internal';
import type { GTConfig } from 'generaltranslation';
import {
  getLoadTranslationsType,
  LoadTranslationsType,
} from '../i18n-cache/utils/getLoadTranslationsType';
import {
  getTranslationApiType,
  TranslationApiType,
} from '../i18n-cache/utils/getTranslationApiType';
import {
  getGeneralTranslationLogLevel,
  isDebugLogLevel,
  type GeneralTranslationLogLevel,
} from '../logs/logLevel';
import { getRuntimeEnvironment } from '../utils/getRuntimeEnvironment';
import { validateI18nConfigParams } from './validation';

export type I18nConfigParams = Pick<
  GTConfig,
  | 'defaultLocale'
  | 'locales'
  | 'customMapping'
  | 'timeZone'
  | 'localeMatcher'
  | 'projectId'
  | 'apiKey'
  | 'cacheUrl'
  | 'runtimeUrl'
  | '_disableDevHotReload'
  | '_tagIds'
>;

type RuntimeConfig = Pick<
  I18nConfigParams,
  'projectId' | 'apiKey' | 'runtimeUrl' | '_disableDevHotReload' | '_tagIds'
>;

export type LocaleCandidates = string | string[] | undefined;

export class I18nConfig extends GTIntl {
  protected runtimeConfig: RuntimeConfig;
  private gtServicesEnabled: boolean;
  private logLevel: GeneralTranslationLogLevel;

  constructor(params: I18nConfigParams = {}) {
    const gtServicesEnabled = resolveGTServicesEnabled(params);
    super(getLocaleConfigParams(params, gtServicesEnabled));
    this.runtimeConfig = {
      projectId: params.projectId,
      apiKey: params.apiKey,
      runtimeUrl: params.runtimeUrl,
      _disableDevHotReload: params._disableDevHotReload,
      _tagIds: params._tagIds,
    };
    this.gtServicesEnabled = gtServicesEnabled;
    this.logLevel = getGeneralTranslationLogLevel();
  }

  getDefaultLocale(): string {
    return this.defaultLocale;
  }

  getLocales(): string[] {
    // A mutable copy of the frozen configured locales.
    return [...this.locales];
  }

  getCustomMapping(): CustomMapping {
    return this.customMapping || {};
  }

  getProjectId(): string | undefined {
    return this.runtimeConfig.projectId;
  }

  /**
   * The runtime for runtime translation. Each framework's initialization
   * resolves the credentials, from its config and then its environment.
   *
   * @throws {Error} Without a projectId or an API key.
   */
  getTranslationRuntime(): GTRuntime {
    const { projectId, apiKey, runtimeUrl } = this.runtimeConfig;
    if (!projectId) throw new Error(missingRuntimeProjectIdError);
    if (!apiKey) throw new Error(missingRuntimeApiKeyError);
    return new GTRuntime({
      apiKey,
      projectId,
      baseUrl: runtimeUrl || undefined,
      localeConfig: this,
    });
  }

  determineLocale(locales: LocaleCandidates): string | undefined {
    if (locales == null || (Array.isArray(locales) && locales.length === 0)) {
      return undefined;
    }
    return super.determineLocale(locales);
  }

  resolveSupportedLocale(candidates?: LocaleCandidates): string {
    return this.determineLocale(candidates) || this.defaultLocale;
  }

  resolveLocale(locale: string): string {
    const resolvedLocale = this.determineLocale(locale);
    if (!this.isValidLocale(locale) || !resolvedLocale) {
      throw new Error(createInvalidLocaleError(locale));
    }
    return resolvedLocale;
  }

  /**
   * Returns true when development hot reload runtime translation requests can
   * run: in development, with an API key and a projectId.
   */
  isDevHotReloadEnabled(): boolean {
    return (
      !this.runtimeConfig._disableDevHotReload &&
      !!this.runtimeConfig.apiKey &&
      !!this.runtimeConfig.projectId &&
      this.runtimeConfig.runtimeUrl !== null &&
      this.runtimeConfig.runtimeUrl !== '' &&
      getRuntimeEnvironment() === 'development'
    );
  }

  isGTServicesEnabled(): boolean {
    return this.gtServicesEnabled;
  }

  isDebugLoggingEnabled(): boolean {
    return isDebugLogLevel(this.logLevel);
  }
}

function getLocaleConfigParams(
  params: I18nConfigParams,
  gtServicesEnabled: boolean
): LocaleConfig {
  const {
    defaultLocale = defaultDefaultLocale,
    locales = [],
    customMapping,
    localeMatcher,
  } = params;

  validateI18nConfigParams(
    {
      ...params,
      defaultLocale,
      locales,
      customMapping,
    },
    gtServicesEnabled
  );

  return {
    defaultLocale,
    locales: Array.from(new Set([defaultLocale, ...locales])),
    customMapping: customMapping || {},
    timeZone: params.timeZone,
    localeMatcher,
  };
}

function resolveGTServicesEnabled(config: I18nConfigParams): boolean {
  return (
    getLoadTranslationsType(config) === LoadTranslationsType.GT_REMOTE ||
    getTranslationApiType(config) === TranslationApiType.GT
  );
}

const createInvalidLocaleError = (locale: string) =>
  createDiagnosticMessage({
    source: 'gt-i18n',
    severity: 'Error',
    whatHappened: `Locale "${locale}" is not valid`,
    fix: 'Use a valid BCP 47 locale code or add a custom mapping',
  });

const missingRuntimeProjectIdError = createDiagnosticMessage({
  source: 'gt-i18n',
  severity: 'Error',
  whatHappened: 'Runtime translation needs a projectId',
  fix: "Set `projectId` in your framework's GT configuration, or disable runtime translation",
});

const missingRuntimeApiKeyError = createDiagnosticMessage({
  source: 'gt-i18n',
  severity: 'Error',
  whatHappened: 'Runtime translation needs an API key',
  fix: "Set `apiKey` in your framework's GT configuration or the GT_API_KEY environment variable, or disable runtime translation",
});
