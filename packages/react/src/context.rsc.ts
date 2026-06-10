// React Server Component-safe context surface.
//
// This entrypoint may import client components only through explicit
// 'use client' boundaries. Do not re-export from context.client, context.server,
// or @generaltranslation/react-core/context here.

export { GTProvider, LocaleSelector } from 'gt-react/client-boundary';

export {
  Branch,
  createRenderPipeline,
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

export {
  decodeMsg,
  decodeOptions,
  decodeVars,
  declareVar,
  derive,
  gtFallback,
  mFallback,
  msg,
} from '@generaltranslation/react-core/pure';

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
