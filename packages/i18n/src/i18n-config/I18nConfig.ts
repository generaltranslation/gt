import { GTIntl, type LocaleConfig } from '@generaltranslation/format';
import type { CustomMapping } from '@generaltranslation/format/types';
import { GTRuntime } from 'generaltranslation/runtime';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import type { GTConfig } from '../config/types';
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
  | 'projectId'
  | 'apiKey'
  | 'cacheUrl'
  | 'runtimeUrl'
  | '_disableDevHotReload'
  | '_tagIds'
> & {
  /** The development API key; it enables hot reload translation in development. */
  devApiKey?: string;
};

type RuntimeConfig = Pick<
  I18nConfigParams,
  | 'projectId'
  | 'devApiKey'
  | 'apiKey'
  | 'runtimeUrl'
  | '_disableDevHotReload'
  | '_tagIds'
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
      devApiKey: params.devApiKey,
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
   * The runtime for runtime translation, with the API key from `apiKey`, then
   * the GT_API_KEY environment variable, then `devApiKey`.
   *
   * @throws {Error} Without a projectId or an API key.
   */
  getTranslationRuntime(): GTRuntime {
    const { projectId, runtimeUrl } = this.runtimeConfig;
    if (!projectId) throw new Error(missingRuntimeProjectIdError);
    const apiKey =
      this.runtimeConfig.apiKey ||
      (typeof process !== 'undefined' && process.env?.GT_API_KEY) ||
      this.runtimeConfig.devApiKey;
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

  determineSupportedLocale(
    candidates: LocaleCandidates,
    config?: I18nConfigParams
  ): string | undefined {
    return this.determineSupportedLocaleWithConfig(
      candidates,
      this.getLocaleConfig(config)
    );
  }

  resolveSupportedLocale(
    candidates?: LocaleCandidates,
    config?: I18nConfigParams
  ): string {
    const localeConfig = this.getLocaleConfig(config);
    return (
      this.determineSupportedLocaleWithConfig(candidates, localeConfig) ||
      localeConfig.defaultLocale
    );
  }

  resolveLocale(locale: string): string {
    const resolvedLocale = this.determineSupportedLocale(locale);
    if (!this.isValidLocale(locale) || !resolvedLocale) {
      throw new Error(
        `Locale "${locale}" is not valid. Use a valid BCP 47 locale code or add a custom mapping.`
      );
    }
    return resolvedLocale;
  }

  /**
   * Returns true when development hot reload runtime translation requests can run.
   */
  isDevHotReloadEnabled(): boolean {
    return (
      !this.runtimeConfig._disableDevHotReload &&
      !!this.runtimeConfig.devApiKey &&
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

  private getLocaleConfig(config?: I18nConfigParams): GTIntl {
    if (!config || !hasI18nConfigParams(config)) {
      return this;
    }
    return new GTIntl(getLocaleResolverConfigParams(config));
  }

  private determineSupportedLocaleWithConfig(
    candidates: LocaleCandidates,
    localeConfig: GTIntl
  ): string | undefined {
    if (
      candidates == null ||
      (Array.isArray(candidates) && candidates.length === 0)
    ) {
      return undefined;
    }
    return localeConfig.determineLocale(candidates);
  }
}

function getLocaleConfigParams(
  params: I18nConfigParams,
  gtServicesEnabled: boolean
): LocaleConfig {
  const {
    defaultLocale = libraryDefaultLocale,
    locales = [],
    customMapping,
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
  };
}

function getLocaleResolverConfigParams({
  defaultLocale = libraryDefaultLocale,
  locales = [],
  customMapping,
}: I18nConfigParams = {}): LocaleConfig {
  return {
    defaultLocale,
    locales: locales?.length ? locales : [defaultLocale],
    customMapping: customMapping || {},
  };
}

function hasI18nConfigParams(config: I18nConfigParams): boolean {
  return (
    config.defaultLocale !== undefined ||
    config.locales !== undefined ||
    config.customMapping !== undefined
  );
}

function resolveGTServicesEnabled(config: I18nConfigParams): boolean {
  return (
    getLoadTranslationsType(config) === LoadTranslationsType.GT_REMOTE ||
    getTranslationApiType(config) === TranslationApiType.GT
  );
}

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
  fix: "Set `apiKey` (or `devApiKey` in development) in your framework's GT configuration or the GT_API_KEY environment variable, or disable runtime translation",
});
