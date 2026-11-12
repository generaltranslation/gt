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

// ===== Helpers ===== //
export { getPluralBranch } from './utils/plurals/getPluralBranch';
export { getShouldTranslate } from './hooks/utils/getShouldTranslate';
export { prepareT } from './utils/translation/prepareT.shared';
export { createRenderVariable } from './utils/rendering/createRenderVariable';
export type { RenderDefaultChildrenArgs } from './utils/rendering/renderDefaultChildren.shared';
export type { RenderPreparedTParams } from './utils/rendering/renderPreparedT.shared';
export type { RenderTranslatedChildrenArgs } from './utils/rendering/renderTranslatedChildren.shared';
// Pre-instantiated RSC render pipeline: bound to the RSC renderVariable, so
// consumers never thread a variable renderer through rendering calls.
export {
  renderDefaultChildren,
  renderPreparedT,
  renderTranslatedChildren,
  renderVariable,
} from './utils/rendering/renderPipeline.rsc';

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
