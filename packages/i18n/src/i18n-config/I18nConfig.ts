import {
  LocaleConfig,
  type LocaleConfigConstructorParams,
} from '@generaltranslation/format';
import type { CustomMapping } from '@generaltranslation/format/types';
import { GT } from 'generaltranslation';
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
  | 'apiKey'
  | 'runtimeUrl'
>;

type RuntimeConfig = Pick<
  I18nConfigParams,
  'projectId' | 'devApiKey' | 'apiKey' | 'runtimeUrl'
>;

export type LocaleCandidates = string | string[] | undefined;

export class I18nConfig extends LocaleConfig {
  private runtimeConfig: RuntimeConfig;

  constructor(params: I18nConfigParams = {}) {
    super(getLocaleConfigParams(params));
    this.runtimeConfig = {
      projectId: params.projectId,
      devApiKey: params.devApiKey,
      apiKey: params.apiKey,
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
    return this.runtimeConfig.projectId;
  }

  /**
   * Get a GT instance bound to the resolved target locale. When omitted, the
   * instance is locale agnostic.
   *
   * TODO: keep a cache to avoid creating new instances unnecessarily.
   */
  getGTClass(locale?: string): GT {
    return this.getGTClassClean(
      locale ? this.resolveLocale(locale) : undefined
    );
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
      !!this.runtimeConfig.devApiKey &&
      !!this.runtimeConfig.projectId &&
      this.runtimeConfig.runtimeUrl !== null &&
      this.runtimeConfig.runtimeUrl !== '' &&
      getRuntimeEnvironment() === 'development'
    );
  }

  /**
   * Create a GT instance without resolving the target locale first.
   */
  private getGTClassClean(locale?: string) {
    return new GT({
      sourceLocale: this.getDefaultLocale(),
      targetLocale: locale,
      // GT validates approved locales before constructing its LocaleConfig, so
      // pass canonical locales here while preserving alias target locales.
      locales: Array.from(
        new Set(
          this.getLocales().map((locale) => this.resolveCanonicalLocale(locale))
        )
      ),
      customMapping: this.getCustomMapping(),
      projectId: this.runtimeConfig.projectId,
      baseUrl: this.runtimeConfig.runtimeUrl || undefined,
      apiKey: this.runtimeConfig.apiKey,
      devApiKey: this.runtimeConfig.devApiKey,
    });
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
