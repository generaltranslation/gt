import {
  LocaleConfig,
  type LocaleConfigConstructorParams,
  getRegionProperties as getFormatRegionProperties,
} from '@generaltranslation/format';
import type {
  CustomMapping,
  CustomRegionMapping,
} from '@generaltranslation/format/types';
import {
  translate as runtimeTranslate,
  translateMany as runtimeTranslateMany,
  type RuntimeTranslateConfig,
  type RuntimeTranslateOptions,
} from 'generaltranslation/runtime';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import type {
  TranslateManyEntry,
  TranslateManyResult,
  TranslationError,
  TranslationResult,
} from 'generaltranslation/types';
import type { GTConfig } from '../config/types';
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
  | 'projectId'
  | 'devApiKey'
  | 'apiKey'
  | 'cacheUrl'
  | 'runtimeUrl'
  | '_disableDevHotReload'
>;

type RuntimeConfig = Pick<
  I18nConfigParams,
  'projectId' | 'devApiKey' | 'apiKey' | 'runtimeUrl' | '_disableDevHotReload'
>;

export type LocaleCandidates = string | string[] | undefined;

export class I18nConfig extends LocaleConfig {
  private runtimeConfig: RuntimeConfig;
  private gtServicesEnabled: boolean;
  private customRegionMapping?: CustomRegionMapping;

  constructor(params: I18nConfigParams = {}) {
    const gtServicesEnabled = resolveGTServicesEnabled(params);
    super(getLocaleConfigParams(params, gtServicesEnabled));
    this.runtimeConfig = {
      projectId: params.projectId,
      devApiKey: params.devApiKey,
      apiKey: params.apiKey,
      runtimeUrl: params.runtimeUrl,
      _disableDevHotReload: params._disableDevHotReload,
    };
    this.gtServicesEnabled = gtServicesEnabled;
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

  async translate(
    source: TranslateManyEntry,
    options: RuntimeTranslateOptions,
    timeout?: number
  ): Promise<TranslationResult | TranslationError> {
    return await runtimeTranslate(
      source,
      options,
      this.getRuntimeTranslateConfig(),
      timeout
    );
  }

  async translateMany(
    sources: TranslateManyEntry[],
    options: RuntimeTranslateOptions,
    timeout?: number
  ): Promise<TranslateManyResult>;
  async translateMany(
    sources: Record<string, TranslateManyEntry>,
    options: RuntimeTranslateOptions,
    timeout?: number
  ): Promise<Record<string, TranslationResult>>;
  async translateMany(
    sources: TranslateManyEntry[] | Record<string, TranslateManyEntry>,
    options: RuntimeTranslateOptions,
    timeout?: number
  ): Promise<TranslateManyResult | Record<string, TranslationResult>> {
    if (Array.isArray(sources)) {
      return await runtimeTranslateMany(
        sources,
        options,
        this.getRuntimeTranslateConfig(),
        timeout
      );
    }
    return await runtimeTranslateMany(
      sources,
      options,
      this.getRuntimeTranslateConfig(),
      timeout
    );
  }

  getRegionProperties(
    region: string,
    targetLocale: string = this.defaultLocale,
    customMapping:
      | CustomRegionMapping
      | undefined = this.getCustomRegionMapping()
  ): { code: string; name: string; emoji: string } {
    return getFormatRegionProperties(region, targetLocale, customMapping);
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

  private getRuntimeTranslateConfig(): RuntimeTranslateConfig {
    return {
      sourceLocale: this.getDefaultLocale(),
      // Runtime requests should use canonical approved locales while preserving
      // alias target locales until each request is resolved.
      locales: Array.from(
        new Set(
          this.getLocales().map((locale) => this.resolveCanonicalLocale(locale))
        )
      ),
      customMapping: this.getCustomMapping(),
      projectId: this.runtimeConfig.projectId || '',
      baseUrl: this.runtimeConfig.runtimeUrl || undefined,
      apiKey: this.runtimeConfig.apiKey || this.runtimeConfig.devApiKey,
    };
  }

  private getCustomRegionMapping(): CustomRegionMapping | undefined {
    if (!this.customMapping) return undefined;
    if (this.customRegionMapping) return this.customRegionMapping;
    const customRegionMapping: CustomRegionMapping = {};
    for (const [locale, properties] of Object.entries(this.customMapping)) {
      if (
        properties &&
        typeof properties === 'object' &&
        properties.regionCode &&
        !customRegionMapping[properties.regionCode]
      ) {
        const { regionName: name, emoji } = properties;
        customRegionMapping[properties.regionCode] = {
          locale,
          ...(name && { name }),
          ...(emoji && { emoji }),
        };
      }
    }
    this.customRegionMapping = customRegionMapping;
    return customRegionMapping;
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
  params: I18nConfigParams,
  gtServicesEnabled: boolean
): LocaleConfigConstructorParams {
  const {
    defaultLocale = libraryDefaultLocale,
    locales = [defaultLocale],
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

function resolveGTServicesEnabled(config: I18nConfigParams): boolean {
  return (
    getLoadTranslationsType(config) === LoadTranslationsType.GT_REMOTE ||
    getTranslationApiType(config) === TranslationApiType.GT
  );
}
