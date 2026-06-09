// This entrypoint is intentionally separate from context (context.server/context.client).
// React Server Component consumers must not transitively import context or hook
// modules that call createContext/useContext. Keep exports explicit and narrow:
// only re-export from @generaltranslation/react-core/context-rsc or other
// RSC-safe modules. Never re-export the broad context barrels.

export {
  Branch,
  createRenderVariable,
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
  prepareT,
  RelativeTime,
  renderDefaultChildren,
  renderPreparedT,
  renderTranslatedChildren,
  renderVariable,
  RscT,
  T,
  Var,
} from '@generaltranslation/react-core/context-rsc';

export type {
  CurrencyProps,
  DateTimeProps,
  JsxTranslationOptions,
  NumProps,
  PluralProps,
  PreparedT,
  RelativeTimeFormatOptions,
  RelativeTimeProps,
  RenderVariable,
  ResolvedCurrencyProps,
  ResolvedDateTimeProps,
  ResolvedNumProps,
  ResolvedPluralProps,
  ResolvedRelativeTimeProps,
} from '@generaltranslation/react-core/context-rsc';
