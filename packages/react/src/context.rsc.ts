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

// ===== Types ===== //
export type {
  CurrencyProps,
  DateTimeProps,
  JsxTranslationOptions,
  NumProps,
  PluralProps,
  PreparedT,
  RelativeTimeProps,
  RelativeTimeFormatOptions,
  RenderVariable,
  ResolvedCurrencyProps,
  ResolvedDateTimeProps,
  ResolvedNumProps,
  ResolvedPluralProps,
  ResolvedRelativeTimeProps,
} from '@generaltranslation/react-core/components-rsc';
