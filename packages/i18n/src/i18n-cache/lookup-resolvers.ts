import type { LookupOptions } from '../translation-functions/types/options';
import { getI18nConfig } from '../i18n-config/singleton-operations';
import { hashMessage } from '../utils/hashMessage';
import {
  getDictionaryEntry,
  getDictionaryValueAtPath,
} from './translations-manager/utils/dictionary-helpers';
import type { Translation } from './translations-manager/utils/types/translation-data';
import type { Hash } from './translations-manager/TranslationsCache';
import type { Locale } from './translations-manager/LocalesCache';
import type {
  Dictionary,
  DictionaryEntry,
  DictionaryObject,
} from './translations-manager/DictionaryCache';

export type TranslationLookupParams = {
  translationLocale: string | undefined;
  options: LookupOptions;
};

export function resolveCacheLocale(locale: string): string | undefined {
  const resolvedLocale = resolveLocale(locale);
  const i18nConfig = getI18nConfig();
  if (i18nConfig.requiresTranslation(resolvedLocale)) {
    return resolvedLocale;
  }

  const aliasLocale = i18nConfig.resolveAliasLocale(
    i18nConfig.standardizeLocale(locale)
  );
  if (i18nConfig.requiresTranslation(aliasLocale)) {
    return aliasLocale;
  }

  return undefined;
}

export function resolveDictionaryCacheLocale(locale: string): string {
  return resolveCacheLocale(locale) ?? getI18nConfig().getDefaultLocale();
}

export function resolveLookupOptions(
  options: LookupOptions = {} as LookupOptions,
  translationLocale?: string
): LookupOptions {
  if (!options.$locale) {
    return options;
  }
  return {
    ...options,
    $locale:
      translationLocale ??
      resolveCacheLocale(options.$locale) ??
      resolveLocale(options.$locale),
  };
}

export function resolveTranslationLookupParams(
  locale: string,
  options: LookupOptions
): TranslationLookupParams {
  const translationLocale = resolveCacheLocale(locale);
  return {
    translationLocale,
    options: translationLocale
      ? resolveLookupOptions(options, translationLocale)
      : options,
  };
}

export function lookupTranslationRecord<
  TranslationValue extends Translation = Translation,
  T extends TranslationValue = TranslationValue,
>(
  translations: Record<Locale, Record<Hash, TranslationValue>> | undefined,
  locale: string,
  message: T,
  options: LookupOptions
): T | undefined {
  const { translationLocale, options: lookupOptions } =
    resolveTranslationLookupParams(locale, options);

  if (!translationLocale) {
    return message;
  }

  return translations?.[translationLocale]?.[
    hashMessage(message, lookupOptions)
  ] as T | undefined;
}

export function lookupDictionaryRecord(
  dictionaries: Record<Locale, Dictionary> | undefined,
  locale: string,
  id: string
): DictionaryEntry | undefined {
  const dictionaryLocale = resolveDictionaryCacheLocale(locale);
  const entry = getDictionaryEntry(
    getDictionaryValueAtPath(dictionaries?.[dictionaryLocale] ?? {}, id)
  );

  if (entry === undefined) {
    return undefined;
  }

  return {
    entry: entry.entry,
    options: structuredClone(entry.options),
  };
}

export function lookupDictionaryObjectRecord(
  dictionaries: Record<Locale, Dictionary> | undefined,
  locale: string,
  id: string
): DictionaryObject | undefined {
  const dictionaryLocale = resolveDictionaryCacheLocale(locale);
  const value = getDictionaryValueAtPath(
    dictionaries?.[dictionaryLocale] ?? {},
    id
  );
  return value === undefined ? undefined : structuredClone(value);
}

function resolveLocale(locale: string): string {
  const i18nConfig = getI18nConfig();
  const resolvedLocale = i18nConfig.determineLocale(locale);
  if (!i18nConfig.isValidLocale(locale) || !resolvedLocale) {
    throw new Error(
      `Locale "${locale}" is not valid. Use a valid BCP 47 locale code or add a custom mapping.`
    );
  }
  return resolvedLocale;
}
