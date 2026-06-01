import {
  LocaleConfig,
  type LocaleConfigConstructorParams,
} from '@generaltranslation/format';
import type { CustomMapping } from '@generaltranslation/format/types';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import type { GTConfig } from '../config/types';
import { getRuntimeEnvironment } from '../utils/getRuntimeEnvironment';
import { validateI18nConfigParams } from './validation';

export type I18nConfigParams = Pick<
  GTConfig,
  | 'defaultLocale'
  | 'locales'
  | 'customMapping'
  | 'projectId'
  | 'devApiKey'
  | 'runtimeUrl'
>;

type DevHotReloadConfig = Pick<
  I18nConfigParams,
  'projectId' | 'devApiKey' | 'runtimeUrl'
>;

export type LocaleCandidates = string | string[] | undefined;

export class I18nConfig extends LocaleConfig {
  private devHotReloadConfig: DevHotReloadConfig;

  constructor(params: I18nConfigParams = {}) {
    super(getLocaleConfigParams(params));
    this.devHotReloadConfig = {
      projectId: params.projectId,
      devApiKey: params.devApiKey,
      runtimeUrl: params.runtimeUrl,
    };
  }

  getDefaultLocale(): string {
    return this.defaultLocale;
  }

  getLocales(): string[] {
    return this.locales;
  }

  getCustomMapping(): CustomMapping {
    return this.customMapping || {};
  }

  getProjectId(): string | undefined {
    return this.devHotReloadConfig.projectId;
  }

  determineLocale(
    locales: LocaleCandidates,
    approvedLocales: string[] = this.locales
  ): string | undefined {
    if (locales == null || (Array.isArray(locales) && locales.length === 0)) {
      return undefined;
    }
    return super.determineLocale(locales, approvedLocales);
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

  requiresDialectTranslation(locale: string): boolean {
    return (
      this.requiresTranslation(locale) &&
      this.isSameLanguage(this.getDefaultLocale(), locale)
    );
  }

  /**
   * Returns true when development hot reload runtime translation requests can run.
   */
  isDevHotReloadEnabled(): boolean {
    return (
      !!this.devHotReloadConfig.devApiKey &&
      !!this.devHotReloadConfig.projectId &&
      this.devHotReloadConfig.runtimeUrl !== null &&
      this.devHotReloadConfig.runtimeUrl !== '' &&
      getRuntimeEnvironment() === 'development'
    );
  }

  private getLocaleConfig(config?: I18nConfigParams): LocaleConfig {
    if (!config || !hasI18nConfigParams(config)) {
      return this;
    }
    return new LocaleConfig(getLocaleResolverConfigParams(config));
  }

  private determineSupportedLocaleWithConfig(
    candidates: LocaleCandidates,
    localeConfig: LocaleConfig
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
  params: I18nConfigParams = {}
): LocaleConfigConstructorParams {
  const {
    defaultLocale = libraryDefaultLocale,
    locales = [defaultLocale],
    customMapping,
  } = params;

  validateI18nConfigParams({
    ...params,
    defaultLocale,
    locales,
    customMapping,
  });

  return {
    defaultLocale,
    locales: Array.from(new Set([defaultLocale, ...locales])),
    customMapping: customMapping || {},
  };
}

function getLocaleResolverConfigParams({
  defaultLocale = libraryDefaultLocale,
  locales,
  customMapping,
}: I18nConfigParams = {}): LocaleConfigConstructorParams {
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
