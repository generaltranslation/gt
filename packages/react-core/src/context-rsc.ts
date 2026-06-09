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

// ===== Helpers ===== //
export { getFormatLocales } from './hooks/utils/getFormatLocales';
export { default as getPluralBranch } from './utils/plurals/getPluralBranch';

// ===== Types ===== //
export type { RelativeTimeFormatOptions, RenderVariable } from './utils/types';
