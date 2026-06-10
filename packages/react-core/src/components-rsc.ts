// React Server Component-safe component entrypoint.
//
// TODO: replace these placeholder exports with dedicated RSC implementations
// as each component is split into shared logic plus runtime-specific wrappers.

export { Branch, GtInternalBranch } from './components/branches/Branch';
export { Derive, GtInternalDerive } from './components/derivation/Derive';
export { RscT, RscT as T } from './components/translation/T';
export { GtInternalVar, Var } from './components/variables/Var';
export { default as getPluralBranch } from './utils/plurals/getPluralBranch';
export type { RelativeTimeFormatOptions, RenderVariable } from './utils/types';
