// This entrypoint is intentionally separate from context.
// React Server Component consumers must not transitively import context or hook
// modules that call createContext/useContext. Keep exports explicit and narrow:
// only modules whose import graphs are free of context and hooks may be
// re-exported here. Never re-export the broad context barrel.

// ===== Components ===== //
export { Branch, GtInternalBranch } from './components/branches/Branch';
export { Derive, GtInternalDerive } from './components/derivation/Derive';
export { GtInternalVar, Var } from './components/variables/Var';

// ===== Helpers ===== //
export { default as getPluralBranch } from './utils/plurals/getPluralBranch';

// ===== Types ===== //
export type { RelativeTimeFormatOptions, RenderVariable } from './utils/types';
