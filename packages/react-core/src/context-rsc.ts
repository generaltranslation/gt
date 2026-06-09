// This entrypoint is intentionally separate from context.
// React Server Component consumers must not transitively import context or hook
// modules that call createContext/useContext. Keep exports explicit and narrow:
// only modules whose import graphs are free of context and hooks may be
// re-exported here. Never re-export the broad context barrel.

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

// ===== Functions ===== //
export { getTranslationsSnapshot } from './functions/helpers/getTranslationsSnapshot';
export { t } from './functions/translation/t';

// ===== Helpers ===== //
export { getFormatLocales } from './hooks/utils/getFormatLocales';
export { getShouldTranslate } from './hooks/utils/getShouldTranslate';
export { default as getPluralBranch } from './utils/plurals/getPluralBranch';

// ===== Internal ===== //
export { internalInitializeGTSRA } from './setup/initializeGTSRA';
export { getReadonlyConditionStoreWithFallback } from './condition-store/singleton-operations';
export {
  getReactI18nCache,
  setReactI18nCache,
} from './i18n-cache/singleton-operations';

// ===== Types ===== //
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
