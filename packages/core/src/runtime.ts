import { LocaleConfig } from '@generaltranslation/format';
import type { CustomMapping } from '@generaltranslation/format/types';
import {
  TranslationRequestConfig,
  TranslateManyResult,
  TranslationError,
  TranslationResult,
} from './types';
import { libraryDefaultLocale } from './settings/settings';
import {
  noApiKeyProvidedError,
  noProjectIdProvidedError,
  noTargetLocaleProvidedError,
} from './logging/errors';
import { _translateMany } from './translate/translateMany';
import type {
  TranslateManyEntry,
  TranslateOptions,
} from './types-dir/api/entry';

export type RuntimeTranslateConfig = TranslationRequestConfig & {
  sourceLocale?: string;
  targetLocale?: string;
  locales?: string[];
  customMapping?: CustomMapping;
};

export type RuntimeTranslateOptions = string | TranslateOptions;

export {
  LocaleConfig,
  type LocaleConfigConstructorParams,
} from '@generaltranslation/format';

export {
  determineLocale,
  formatCurrency,
  formatCutoff,
  formatDateTime,
  formatList,
  formatListToParts,
  formatMessage,
  formatNum,
  formatRelativeTime,
  formatRelativeTimeFromDate,
  getLocaleDirection,
  getLocaleEmoji,
  getLocaleName,
  getLocaleProperties,
  getRegionProperties,
  isSameDialect,
  isSameLanguage,
  isSupersetLocale,
  isValidLocale,
  requiresTranslation,
  resolveAliasLocale,
  resolveCanonicalLocale,
  standardizeLocale,
} from '@generaltranslation/format';

export async function translate(
  source: TranslateManyEntry,
  options: RuntimeTranslateOptions,
  config: RuntimeTranslateConfig,
  timeout?: number
): Promise<TranslationResult | TranslationError> {
  const results = await translateMany([source], options, config, timeout);
  return results[0];
}

export async function translateMany(
  sources: TranslateManyEntry[],
  options: RuntimeTranslateOptions,
  config: RuntimeTranslateConfig,
  timeout?: number
): Promise<TranslateManyResult>;
export async function translateMany(
  sources: Record<string, TranslateManyEntry>,
  options: RuntimeTranslateOptions,
  config: RuntimeTranslateConfig,
  timeout?: number
): Promise<Record<string, TranslationResult>>;
export async function translateMany(
  sources: TranslateManyEntry[] | Record<string, TranslateManyEntry>,
  options: RuntimeTranslateOptions,
  config: RuntimeTranslateConfig,
  timeout?: number
): Promise<TranslateManyResult | Record<string, TranslationResult>> {
  const normalizedOptions =
    typeof options === 'string' ? { targetLocale: options } : options;
  validateRuntimeAuth(config, 'translateMany');

  const localeConfig = new LocaleConfig({
    defaultLocale: config.sourceLocale || libraryDefaultLocale,
    locales: config.locales ?? [],
    customMapping: config.customMapping,
  });

  const targetLocale = normalizedOptions.targetLocale || config.targetLocale;
  if (!targetLocale) {
    throw new Error(noTargetLocaleProvidedError('translateMany'));
  }

  return await _translateMany(
    sources,
    {
      ...normalizedOptions,
      targetLocale: localeConfig.resolveCanonicalLocale(targetLocale),
      sourceLocale: localeConfig.resolveCanonicalLocale(
        normalizedOptions.sourceLocale ||
          config.sourceLocale ||
          libraryDefaultLocale
      ),
    },
    config,
    timeout
  );
}

function validateRuntimeAuth(
  config: RuntimeTranslateConfig,
  functionName: string
) {
  const errors: string[] = [];
  if (!config.apiKey) {
    errors.push(noApiKeyProvidedError(functionName));
  }
  if (!config.projectId) {
    errors.push(noProjectIdProvidedError(functionName));
  }
  if (errors.length) {
    throw new Error(errors.join('\n'));
  }
}
