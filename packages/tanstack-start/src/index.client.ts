"use client";

import { I18nManager } from "gt-i18n/internal";
import type { Translation } from "gt-i18n/types";
import {
  setReactI18nManager,
  type ReactI18nManagerParams,
} from "@generaltranslation/react-core/context";

export {
  // ===== Components ===== //
  Branch,
  Plural,
  Derive,
  LocaleSelector,
  T,
  Currency,
  DateTime,
  RelativeTime,
  Var,
  Num,
  GTProvider,
  // ===== Hooks ===== //
  useLocale,
  useSetLocale,
  useCustomMapping,
  useDefaultLocale,
  useEnableI18n,
  useSetEnableI18n,
  useLocales,
  useLocaleSelector,
  useFormatLocales,
  useGT,
  useMessages,
  useTranslations,
  // ===== Functions ===== //
  getTranslationsSnapshot,
} from "gt-react/context";

// ===== Setup ===== //
export function initializeGT(config: ReactI18nManagerParams): void {
  setReactI18nManager(new I18nManager<Translation>(config));
}
