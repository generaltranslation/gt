// ===== Setup ===== //
export { createGT } from './plugin';
export type { GTOptions, GTPlugin } from './plugin';

// ===== Components ===== //
export { T } from './components/T';
export { Branch, Plural } from './components/branches';
export {
  Currency,
  DateTime,
  Num,
  RelativeTime,
  Var,
} from './components/variables';
export { LocaleSelector } from './components/LocaleSelector';

// ===== Composables ===== //
export {
  useDefaultLocale,
  useLocale,
  useLocaleDirection,
  useLocaleProperties,
  useLocales,
} from './locale-composables';
export { useGT, useMessages } from './translate';
export { useTranslations } from './dictionary';
export type { UseTranslationsFunction } from './dictionary';

// ===== Functions ===== //
export { t } from './translate';
export { decodeMsg, decodeOptions, gtFallback, mFallback, msg } from 'gt-i18n';

// ===== Cookies ===== //
export { defaultLocaleCookieName } from './condition-store';

// ===== Types ===== //
export type {
  Dictionary,
  DictionaryEntryOptions,
  GTFunctionType,
  GTTranslationOptions,
  MFunctionType,
  Translation,
  TranslationVariables,
} from 'gt-i18n/types';
