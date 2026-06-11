// React Server Component context surface.

// ===== Client Boundary Components ===== //
export { GTProvider, LocaleSelector } from './context.server';

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

// ===== Hooks (no-ops) ===== //
function failHook(hookName: string) {
    throw new Error(`${hookName} is not available in RSC context`);
}

export function useGT() {
  return failHook('useGT');
}
export function useTranslations() {
  return failHook('useTranslations');
}
export function useMessages() {
  return failHook('useMessages');
}
export function useLocale() {
  return failHook('useLocale');
}
export function useLocaleDirection() {
  return failHook('useLocaleDirection');
}
export function useVersionId() {
  return failHook('useVersionId');
}
export function useLocales() {
  return failHook('useLocales');
}
export function useGTClass() {
  return failHook('useGTClass');
}
export function useLocaleProperties(locale: string) {
  return failHook('useLocaleProperties');
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

// ===== Runtime Helpers ===== //
export {
  getReactI18nCache,
  getReadonlyConditionStoreWithFallback,
  setReactI18nCache,
} from '@generaltranslation/react-core/components-rsc';

// ===== Message Helpers ===== //
export {
  decodeMsg,
  decodeOptions,
  decodeVars,
  declareVar,
  derive,
  gtFallback,
  mFallback,
  msg,
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
