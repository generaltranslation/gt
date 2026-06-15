// React Server Component context surface.

import { createDiagnosticMessage } from 'generaltranslation/internal';
import { CustomMapping } from 'generaltranslation/types';
import {
  getGT,
  getI18nConfig,
  getLocale,
  getMessages,
  getTranslations,
} from 'gt-i18n/internal';
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
export function useTranslations() {
  return use(getTranslations());
}
export function useMessages() {
  return use(getMessages());
}
export function useLocale() {
  return getLocale();
}
export function useVersionId() {
  throw new Error(
    createDiagnosticMessage({
      source: 'gt-react',
      severity: 'Error',
      whatHappened: 'useVersionId() is not implemented in the RSC entry point',
      fix: 'Use getVersionId() or import useVersionId() from a supported runtime entry point.',
    })
  );
}
export function useLocales() {
  return getI18nConfig().getLocales();
}
export function useGTClass() {
  return getI18nConfig().getGTClass();
}
export function useLocaleDirection(locale: string) {
  return getI18nConfig().getGTClass().getLocaleDirection(locale);
}
export function useLocaleProperties(locale: string) {
  return getI18nConfig().getGTClass().getLocaleProperties(locale);
}
export function useDefaultLocale(): string {
  return getI18nConfig().getDefaultLocale();
}
export function useCustomMapping(): CustomMapping {
  return getI18nConfig().getCustomMapping();
}
// ===== Internal Components ===== //
export {
  GtInternalBranch,
  GtInternalCurrency,
  GtInternalDateTime,
  GtInternalDerive,
  GtInternalNum,
  GtInternalPlural,
  GtInternalRelativeTime,
  GtInternalVar,
} from '@generaltranslation/react-core/components-rsc';

// ===== Render Helpers ===== //
export {
  createRenderPipeline,
  createRenderVariable,
  renderDefaultChildren,
  renderPreparedT,
  renderTranslatedChildren,
  renderVariable,
} from '@generaltranslation/react-core/components-rsc';

// ===== Translation Helpers ===== //
export {
  getFormatLocales,
  getPluralBranch,
  getShouldTranslate,
  getTranslationsSnapshot,
  prepareT,
  t,
} from '@generaltranslation/react-core/components-rsc';

// ===== Internal ===== //
export {
  getReactI18nCache,
  getReadonlyConditionStoreWithFallback,
  setReactI18nCache,
} from '@generaltranslation/react-core/components-rsc';

// ===== Functions ===== //
export {
  decodeMsg,
  decodeOptions,
  decodeVars,
  declareVar,
  derive,
  gtFallback,
  mFallback,
  msg,
  getDefaultLocale,
  getGTClass,
  getLocaleProperties,
  getLocales,
  getVersionId,
} from '@generaltranslation/react-core/pure';

// ===== Setup ===== //
export { initializeGT } from '@generaltranslation/react-core/pure';

// ===== Types ===== //
export type {
  CurrencyProps,
  DateTimeProps,
  JsxTranslationOptions,
  NumProps,
  PluralProps,
  PreparedT,
  RelativeTimeFormatOptions,
  RelativeTimeProps,
  RenderVariable,
  ResolvedCurrencyProps,
  ResolvedDateTimeProps,
  ResolvedNumProps,
  ResolvedPluralProps,
  ResolvedRelativeTimeProps,
} from '@generaltranslation/react-core/components-rsc';

export type { SharedGTProviderProps } from './provider/GTProviderProps';

// ===== Singletons ===== //
export {
  ReactI18nCache,
  type ReactI18nCacheParams,
} from '@generaltranslation/react-core/pure';
