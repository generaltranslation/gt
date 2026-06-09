// This entrypoint is intentionally separate from context (context.server/context.client).
// React Server Component consumers must not transitively import context or hook
// modules that call createContext/useContext. Keep exports explicit and narrow:
// only re-export from @generaltranslation/react-core/context-rsc or other
// RSC-safe modules. Never re-export the broad context barrels.

export {
  Branch,
  Currency,
  DateTime,
  Derive,
  getFormatLocales,
  getPluralBranch,
  GtInternalBranch,
  GtInternalCurrency,
  GtInternalDateTime,
  GtInternalDerive,
  GtInternalNum,
  GtInternalPlural,
  GtInternalRelativeTime,
  GtInternalVar,
  Num,
  Plural,
  RelativeTime,
  Var,
} from '@generaltranslation/react-core/context-rsc';

// RSC facade over the interactive client implementation (an intentional
// server-to-client boundary; see components/LocaleSelector.rsc.tsx).
export { RscLocaleSelector as LocaleSelector } from './components/LocaleSelector.rsc';

export type {
  RelativeTimeFormatOptions,
  RenderVariable,
} from '@generaltranslation/react-core/context-rsc';
