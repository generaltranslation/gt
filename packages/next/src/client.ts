'use client';
import {
  T,
  useGT,
  useLocale,
  useDefaultLocale,
  LocaleSelector,
  GTProvider,
  useLocales,
  useSetLocale,
  useLocaleSelector,
  Var,
  Currency,
  DateTime,
  Num,
  Plural,
  Branch,
  useLocaleProperties,
  useGTClass,
  useTranslations,
} from 'gt-react/client';

export {
  GTProvider as GTClientProvider,
  T,
  useGT,
  useLocale,
  useLocales,
  useSetLocale,
  useDefaultLocale,
  useTranslations,
  /**
   * @deprecated Use useTranslations instead
   */
  useTranslations as useDict,
  LocaleSelector,
  useLocaleSelector,
  Var,
  Currency,
  DateTime,
  Num,
  Plural,
  Branch,
  useGTClass,
  useLocaleProperties,
};
