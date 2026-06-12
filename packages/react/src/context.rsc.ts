// React Server Component context surface.

import { getGT, getI18nConfig, getLocale, getMessages, getTranslations } from 'gt-i18n/internal';
import { use } from 'react';

// ===== Error for client components ===== //
function failClientComponent(componentName: string) {
  throw new Error(`${componentName} cannot be consumed via RSC entrypoint`);
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
  throw new Error('useVersionId unimplemented')
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
export {
  initializeGT,
} from '@generaltranslation/react-core/pure';

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

// ===== Singletons ===== //
export {
  ReactI18nCache,
  type ReactI18nCacheParams,
} from '@generaltranslation/react-core/pure';
