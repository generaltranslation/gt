// What a server component imports: one that TanStack Start renders with
// renderServerComponent() or createCompositeComponent(), in the environment
// where the react-server condition applies. It reads the request's locale
// from the request, not from context.
export { Branch, Derive } from '@generaltranslation/react-core/components-rsc';
export {
  Currency,
  DateTime,
  GtInternalTranslateJsx,
  GtInternalVar,
  N,
  Num,
  Plural,
  RelativeTime,
  T,
  Var,
} from './rsc/components';
// Fail when a server component renders or calls them
export { LocaleSelector, useLocaleSelector } from 'gt-react';
export {
  setupRouterGTIntegration,
  useEnableI18n,
  useFormatLocales,
  useGT,
  useLocale,
  useMessages,
  useSetEnableI18n,
  useSetLocale,
} from './rsc/hooks';
export { useCustomMapping, useDefaultLocale, useLocales } from 'gt-react';
export {
  msg,
  mFallback,
  derive,
  plural,
  selectordinal,
  select,
  number,
  date,
  time,
  part,
  n,
} from 'gt-i18n';
export {
  getLocale,
  getEnableI18n,
  getGT,
  getMessages,
} from './functions/runtime.server';
