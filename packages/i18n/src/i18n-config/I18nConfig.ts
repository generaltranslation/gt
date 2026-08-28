import {
  LocaleResolver,
  type LocaleResolverConstructorParams,
} from '@generaltranslation/format/internal';
import { getRegionProperties as getRegionPropertiesForLocale } from '@generaltranslation/format';
import type {
  CustomMapping,
  CustomRegionMapping,
} from '@generaltranslation/format/types';
import type { GTRuntime } from 'generaltranslation/runtime';
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
  | '_tagIds'
>;

export type LocaleCandidates = string | string[] | undefined;

/** Locale and catalog configuration shared by browser and full runtimes. */
export class I18nConfig extends LocaleResolver {
  private projectId: string | undefined;

  constructor(
    params: I18nConfigParams = {},
    private gtServicesEnabled = resolveGTServicesEnabled(params)
  ) {
    super(getLocaleConfigParams(params, gtServicesEnabled));
    this.projectId = params.projectId;
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
    return this.projectId;
  }

  getRegionProperties(region: string, locale: string = this.defaultLocale) {
    const customRegionMapping: CustomRegionMapping = {};
    for (const [mappedLocale, value] of Object.entries(
      this.customMapping ?? {}
    )) {
      if (
        value &&
        typeof value === 'object' &&
        value.regionCode &&
        !customRegionMapping[value.regionCode]
      ) {
        customRegionMapping[value.regionCode] = {
          locale: mappedLocale,
          ...(value.regionName && { name: value.regionName }),
          ...(value.emoji && { emoji: value.emoji }),
        };
      }
    }
    return getRegionPropertiesForLocale(region, locale, customRegionMapping);
  }

  getGTClass(_locale?: string): GTRuntime {
    throw new Error(
      'GTRuntime is not available in production browser builds. Import formatting helpers from @generaltranslation/format.'
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

  resolveTranslationLocale(locale: string): string | undefined {
    const resolvedLocale = this.resolveLocale(locale);
    if (this.requiresTranslation(resolvedLocale)) return resolvedLocale;

    const aliasLocale = this.resolveAliasLocale(this.standardizeLocale(locale));
    return this.requiresTranslation(aliasLocale) ? aliasLocale : undefined;
  }

  isDevHotReloadEnabled(): boolean {
    return false;
  }

  isGTServicesEnabled(): boolean {
    return this.gtServicesEnabled;
  }

  isDebugLoggingEnabled(): boolean {
    return false;
  }

  private getLocaleConfig(config?: I18nConfigParams): LocaleResolver {
    if (!config || !hasI18nConfigParams(config)) {
      return this;
    }
    return new LocaleResolver(getLocaleResolverConfigParams(config));
  }

  private determineSupportedLocaleWithConfig(
    candidates: LocaleCandidates,
    localeConfig: LocaleResolver
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
): LocaleResolverConstructorParams {
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
}: I18nConfigParams = {}): Required<LocaleResolverConstructorParams> {
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
