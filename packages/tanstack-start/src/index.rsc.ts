// What a server component imports: one that TanStack Start renders with
// renderServerComponent() or createCompositeComponent(), in the environment
// where the react-server condition applies. It reads the request's locale
// from the request, not from context.
export {
  Derive,
  GtInternalVar,
  Select,
  Var,
} from '@generaltranslation/react-core/components-rsc';
export {
  Currency,
  DateTime,
  GtInternalTranslateJsx,
  N,
  Num,
  Ordinal,
  Plural,
  RelativeTime,
  T,
} from './rsc/components';
export { LocaleSelector } from './rsc/clientBoundary';
export { setupRouterGTIntegration } from './rsc/setupRouterGTIntegration';
export {
  useCustomMapping,
  useDefaultLocale,
  useEnableI18n,
  useFormatLocales,
  useGT,
  useLocale,
  useLocales,
  useMessages,
  useSetEnableI18n,
  useSetLocale,
} from './rsc/hooks';
// Fails when a server component calls it
export { useLocaleSelector } from 'gt-react';
export {
  msg,
  mFallback,
  derive,
  plural,
  ordinal,
  select,
  num,
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
