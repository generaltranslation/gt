// React Server Component context surface.

export { parseLocale } from './functions/parseLocale';

import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import type { CustomMapping } from '@generaltranslation/format';
import { getGT, getI18nConfig, getMessages } from 'gt-i18n/internal';
// shortcut: R5 compat glue, removed in R6 when GTProvider/initializeGT stop accepting dictionaries
import { getTranslations } from 'gt-i18n/internal';
import { getLocale, getRegion } from 'gt-i18n';
import { use } from 'react';

// ===== Error for client components ===== //
function failClientComponent(componentName: string) {
  throw new Error(
    createDiagnosticMessage({
      source: 'gt-react',
      severity: 'Error',
      whatHappened: `${componentName} cannot be consumed via the RSC entry point`,
      fix: 'Import this component from a client or server runtime entry point instead.',
    })
  );
}

export function GTProvider() {
  return failClientComponent('GTProvider');
}
export function LocaleSelector() {
  return failClientComponent('LocaleSelector');
}
export function RegionSelector() {
  return failClientComponent('RegionSelector');
}

// ===== Components ===== //
export {
  Branch,
  Currency,
  DateTime,
  Derive,
  Num,
  Plural,
  RelativeTime,
  T,
  Var,
  Tx,
} from '@generaltranslation/react-core/components-rsc';

// ===== Hooks (cannot reference context) ===== //

export function useGT() {
  return use(getGT());
}
// shortcut: R5 compat glue, removed in R6 when GTProvider/initializeGT stop accepting dictionaries
export function useTranslations(rootId?: string) {
  return use(getTranslations(rootId));
}
export function useMessages() {
  return use(getMessages());
}
export function useLocale() {
  return getLocale();
}
export function useRegion() {
  return getRegion();
}
export function useLocales() {
  return getI18nConfig().getLocales();
}
export function useLocaleDirection(locale: string) {
  return getI18nConfig().getLocaleDirection(locale);
}
export function useLocaleProperties(locale: string) {
  return getI18nConfig().getLocaleProperties(locale);
}
export function useDefaultLocale(): string {
  return getI18nConfig().getDefaultLocale();
}
export function useCustomMapping(): CustomMapping {
  return getI18nConfig().getCustomMapping();
}
// ===== Internal Components ===== //
export {
  T as GtInternalTranslateJsx,
  GtInternalVar,
} from '@generaltranslation/react-core/components-rsc';

// ===== Translation Helpers ===== //
export {
  getTranslationsSnapshot,
  t,
} from '@generaltranslation/react-core/pure';

// ===== Functions ===== //
export {
  decodeMsg,
  decodeOptions,
  gtFallback,
  mFallback,
  msg,
  getDefaultLocale,
  getLocaleProperties,
  getLocales,
  resolveCanonicalLocale,
  getVersionId,
} from 'gt-i18n';
export { decodeVars, declareVar, derive } from 'generaltranslation';

// ===== Setup ===== //
// shortcut: R5 compat glue, removed in R6 when GTProvider/initializeGT stop accepting dictionaries
export { initializeGTRSC as initializeGT } from './setup/initializeGTRSC';

// ===== Types ===== //
export type {
  CurrencyProps,
  DateTimeProps,
  JsxTranslationOptions,
  NumProps,
  PluralProps,
  PreparedT,
  RelativeTimeProps,
  ResolvedCurrencyProps,
  ResolvedDateTimeProps,
  ResolvedNumProps,
  ResolvedPluralProps,
  ResolvedRelativeTimeProps,
} from '@generaltranslation/react-core/components-rsc';
export type {
  RelativeTimeFormatOptions,
  RenderVariable,
} from '@generaltranslation/react-core/pure';

export type { SharedGTProviderProps } from './provider/GTProviderProps';
export {
  GtInternalRuntimeTranslateJsx,
  GtInternalRuntimeTranslateString,
} from 'gt-i18n/internal';
export type { GTTranslationOptions, RuntimeTranslationOptions } from 'gt-i18n';
