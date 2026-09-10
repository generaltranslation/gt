// React Server Component-safe component entrypoint.
//
// TODO: replace these placeholder exports with dedicated RSC implementations
// as each component is split into shared logic plus runtime-specific wrappers.

// ===== Components ===== //
export { Branch, GtInternalBranch } from './components/branches/Branch';
export { Derive, GtInternalDerive } from './components/derivation/Derive';
export { GtInternalVar, Var } from './components/variables/Var';
export {
  RscGtInternalPlural as GtInternalPlural,
  RscPlural as Plural,
} from './components/branches/Plural.rsc';
export {
  RscCurrency as Currency,
  RscGtInternalCurrency as GtInternalCurrency,
} from './components/variables/Currency.rsc';
export {
  RscDateTime as DateTime,
  RscGtInternalDateTime as GtInternalDateTime,
} from './components/variables/DateTime.rsc';
export {
  RscGtInternalNum as GtInternalNum,
  RscNum as Num,
} from './components/variables/Num.rsc';
export {
  RscGtInternalRelativeTime as GtInternalRelativeTime,
  RscRelativeTime as RelativeTime,
} from './components/variables/RelativeTime.rsc';
export { RscT as T } from './components/translation/T.rsc';
export { RscTx as Tx } from './components/translation/Tx.rsc';

// ===== Functions ===== //
export { getTranslationsSnapshot } from './functions/helpers/getTranslationsSnapshot';
export { t } from './functions/translation/t';

// ===== Helpers ===== //
export { getFormatLocales } from './pure';
export { getPluralBranch } from './utils/plurals/getPluralBranch';
export { createRenderPipeline } from './utils/rendering/createRenderPipeline';
export type { RenderPipeline } from './utils/rendering/createRenderPipeline';

// ===== Internal ===== //
export { internalInitializeGTSRA } from './setup/initializeGTSRA';
export { getReadonlyConditionStore } from './condition-store/singleton-operations';
export {
  getReactI18nCache,
  setReactI18nCache,
} from './i18n-cache/singleton-operations';

// ===== Types ===== //
export type {
  JsxTranslationOptions,
  PreparedT,
} from './utils/translation/prepareT.shared';
export type {
  PluralProps,
  ResolvedPluralProps,
} from './components/branches/Plural.shared';
export type {
  CurrencyProps,
  ResolvedCurrencyProps,
} from './components/variables/Currency.shared';
export type {
  DateTimeProps,
  ResolvedDateTimeProps,
} from './components/variables/DateTime.shared';
export type {
  NumProps,
  ResolvedNumProps,
} from './components/variables/Num.shared';
export type {
  RelativeTimeProps,
  ResolvedRelativeTimeProps,
} from './components/variables/RelativeTime.shared';
export type { RelativeTimeFormatOptions, RenderVariable } from './utils/types';
