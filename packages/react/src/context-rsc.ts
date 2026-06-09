// This entrypoint is intentionally separate from context (context.server/context.client).
// React Server Component consumers must not transitively import context or hook
// modules that call createContext/useContext. Keep exports explicit and narrow:
// only re-export from @generaltranslation/react-core/context-rsc or other
// RSC-safe modules. Never re-export the broad context barrels.

export {
  Branch,
  Derive,
  getPluralBranch,
  GtInternalBranch,
  GtInternalDerive,
  GtInternalVar,
  Var,
} from '@generaltranslation/react-core/context-rsc';

export type {
  RelativeTimeFormatOptions,
  RenderVariable,
} from '@generaltranslation/react-core/context-rsc';
