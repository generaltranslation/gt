'use client';

import { determineLocale } from '@generaltranslation/format';
import type { CustomMapping } from '@generaltranslation/format/types';
import {
  Var,
  Num,
  Currency,
  DateTime,
  RelativeTime,
  Static,
  Derive,
  T,
  Branch,
  Plural,
  LocaleSelector,
  RegionSelector,
  useGT,
  useTranslations,
  useLocale,
  useLocales,
  useDefaultLocale,
  useGTClass,
  useLocaleProperties,
  useLocaleDirection,
  useVersionId,
  useMessages,
  msg,
  decodeMsg,
  decodeOptions,
  declareStatic,
  derive,
  declareVar,
  decodeVars,
  mFallback,
  gtFallback,
} from 'gt-react/client';
import {
  gtProviderUseClientError,
  txUseClientError,
} from './errors/createErrors';
import type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
} from 'gt-react';

type ClientI18NConfig = {
  customMapping?: CustomMapping;
  defaultLocale?: string;
  locales?: string[];
};

let clientI18NConfig: ClientI18NConfig | undefined;

function getClientI18NConfig(): ClientI18NConfig {
  if (clientI18NConfig) return clientI18NConfig;

  try {
    clientI18NConfig = JSON.parse(
      process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS || '{}'
    );
  } catch {
    clientI18NConfig = {};
  }

  return clientI18NConfig || {};
}

/**
 * Checks whether a locale is valid and supported by the current gt-next config.
 *
 * @param locale - The locale candidate to validate.
 * @returns True when the locale resolves to one of the configured locales.
 */
export function isLocaleSupported(locale: unknown): locale is string {
  if (typeof locale !== 'string' || locale.length === 0) return false;

  const { customMapping, defaultLocale, locales } = getClientI18NConfig();
  const approvedLocales =
    locales && locales.length > 0
      ? locales
      : [
          defaultLocale ||
            process.env._GENERALTRANSLATION_DEFAULT_LOCALE ||
            'en',
        ];

  return (
    determineLocale([locale], approvedLocales, customMapping) !== undefined
  );
}

// Mock <GTProvider> which throws an error
export function GTProvider() {
  throw new Error(gtProviderUseClientError);
}

// Mock <Tx> which throws an error
export function Tx() {
  throw new Error(txUseClientError);
}

export {
  T,
  Var,
  Num,
  Currency,
  DateTime,
  RelativeTime,
  Static,
  Derive,
  Branch,
  Plural,
  LocaleSelector,
  RegionSelector,
  useGT,
  useTranslations,
  useLocale,
  useLocales,
  useDefaultLocale,
  useGTClass,
  useLocaleProperties,
  useLocaleDirection,
  useVersionId,
  useMessages,
  msg,
  decodeMsg,
  decodeOptions,
  declareStatic,
  derive,
  declareVar,
  decodeVars,
  mFallback,
  gtFallback,
};
export type {
  DictionaryTranslationOptions,
  InlineTranslationOptions,
  RuntimeTranslationOptions,
};
