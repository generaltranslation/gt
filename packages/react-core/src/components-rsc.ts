// React Server Component-safe component entrypoint.
//
// TODO: replace these placeholder exports with dedicated RSC implementations
// as each component is split into shared logic plus runtime-specific wrappers.

export { Branch, GtInternalBranch } from './components/branches/Branch';
export { Derive, GtInternalDerive } from './components/derivation/Derive';
export {
  RscGtInternalPlural as GtInternalPlural,
  RscPlural as Plural,
} from './components/branches/Plural.rsc';
export { RscT, RscT as T } from './components/translation/T';
export { GtInternalVar, Var } from './components/variables/Var';
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
export { default as getPluralBranch } from './utils/plurals/getPluralBranch';
export type { RelativeTimeFormatOptions, RenderVariable } from './utils/types';
