// React Server Component context surface.

export { GTProvider, LocaleSelector } from './context.server';

export {
  Branch,
  Currency,
  DateTime,
  Derive,
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
  T,
  Var,
} from '@generaltranslation/react-core/components-rsc';

export {
  decodeMsg,
  decodeOptions,
  decodeVars,
  declareVar,
  derive,
  getFormatLocales,
  getPluralBranch,
  gtFallback,
  mFallback,
  msg,
} from '@generaltranslation/react-core/pure';

export type {
  RelativeTimeFormatOptions,
  RenderVariable,
} from '@generaltranslation/react-core/pure';
