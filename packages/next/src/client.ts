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
  // Hooks
  useGT,
  useTranslations,
  useLocale,
  useLocales,
  useSetLocale,
  useDefaultLocale,
  useLocaleSelector,
  useGTClass,
  useLocaleProperties,

  // Components
  GTProvider as GTClientProvider,
  T,
  Var,
  Currency,
  DateTime,
  Num,
  Plural,
  Branch,
  LocaleSelector,
};
