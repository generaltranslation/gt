import type { LocaleConfig, CustomMapping } from '@generaltranslation/format';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { LocaleIntl } from 'generaltranslation/internal';
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
  | '_versionId'
>;

type RuntimeConfig = Pick<
  I18nConfigParams,
  | 'projectId'
  | 'apiKey'
  | 'runtimeUrl'
  | '_disableDevHotReload'
  | '_tagIds'
  | '_versionId'
>;

export type LocaleCandidates = string | string[] | undefined;

export class I18nConfig extends LocaleIntl {
  protected runtimeConfig: RuntimeConfig;
  private gtServicesEnabled: boolean;

  constructor(params: I18nConfigParams = {}) {
    const gtServicesEnabled = resolveGTServicesEnabled(params);
    super(getLocaleConfigParams(params, gtServicesEnabled));
    this.runtimeConfig = {
      projectId: params.projectId,
      apiKey: params.apiKey,
      runtimeUrl: params.runtimeUrl,
      _disableDevHotReload: params._disableDevHotReload,
      _tagIds: params._tagIds,
      _versionId: params._versionId,
    };
    this.gtServicesEnabled = gtServicesEnabled;
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

  getVersionId(): string | undefined {
    return this.runtimeConfig._versionId;
  }

  /** The credentials and endpoint that createGTRuntime() reads. */
  getRuntimeConfig(): Readonly<RuntimeConfig> {
    return this.runtimeConfig;
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
