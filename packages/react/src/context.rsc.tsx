// React Server Component implementation of gt-react/context. The package
// exports map resolves gt-react/context here under the react-server
// condition, so users import gt-react/context everywhere and the runtime
// picks the right implementation — they never need to know this file exists.
//
// This module must mirror the context.server export surface exactly (enforced
// by a parity test) while staying free of hook/context imports:
// - Pure functions (msg, t, ...) are the real implementations.
// - Components resolve request conditions from the read-only condition store
//   singleton when not passed explicitly — the same fallback the hook-based
//   implementations use when no provider is mounted.
// - Client components (GTProvider, LocaleSelector, the client <T>) are
//   wrapped through a dedicated 'use client' boundary entry. The build keeps
//   that entry external so the directive survives (see tsdown.config.mts).
// - APIs that cannot work in a React Server Component (store-backed hooks,
//   client setup) throw with an actionable message.

import {
  Branch,
  Currency as RscCurrency,
  DateTime as RscDateTime,
  Derive,
  getFormatLocales,
  getReactI18nCache,
  getReadonlyConditionStoreWithFallback,
  getTranslationsSnapshot,
  internalInitializeGTSRA,
  Num as RscNum,
  Plural as RscPlural,
  RelativeTime as RscRelativeTime,
  setReactI18nCache,
  t,
  Var,
  type CurrencyProps,
  type DateTimeProps,
  type NumProps,
  type PluralProps,
  type RelativeTimeProps,
} from '@generaltranslation/react-core/context-rsc';
import { getI18nConfig } from 'gt-i18n/internal';
import type { CustomMapping } from 'generaltranslation/types';
import {
  GTProvider as ClientGTProvider,
  GtInternalTranslateJsx as ClientGtInternalTranslateJsx,
  LocaleSelector as ClientLocaleSelector,
  T as ClientT,
} from './context.client-boundary';

// ===== Client boundary ===== //

export function GTProvider(
  props: Parameters<typeof ClientGTProvider>[0]
): React.JSX.Element {
  return <ClientGTProvider {...props} />;
}

export function LocaleSelector(
  props: Parameters<typeof ClientLocaleSelector>[0]
): React.JSX.Element {
  return <ClientLocaleSelector {...props} />;
}

// TODO: serve the server-side translation implementation here once its
// import graph is RSC-safe; until then <T> renders through the client
// boundary, like any other client component.
export function T(props: Parameters<typeof ClientT>[0]): React.JSX.Element {
  return <ClientT {...props} />;
}

export function GtInternalTranslateJsx(
  props: Parameters<typeof ClientGtInternalTranslateJsx>[0]
): React.JSX.Element {
  return <ClientGtInternalTranslateJsx {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
T._gtt = 'translate-client';
GtInternalTranslateJsx._gtt = 'translate-client-automatic';

// ===== Components ===== //

function resolveConditions(props: {
  _locale?: string;
  _enableI18n?: boolean;
}): { _locale: string; _enableI18n: boolean } {
  const conditionStore = getReadonlyConditionStoreWithFallback();
  return {
    _locale: props._locale ?? conditionStore.getLocale(),
    _enableI18n: props._enableI18n ?? conditionStore.getEnableI18n(),
  };
}

function Plural(props: PluralProps): React.JSX.Element {
  return <RscPlural {...props} {...resolveConditions(props)} />;
}

function Currency(props: CurrencyProps): React.JSX.Element {
  return <RscCurrency {...props} {...resolveConditions(props)} />;
}

function DateTime(props: DateTimeProps): React.JSX.Element {
  return <RscDateTime {...props} {...resolveConditions(props)} />;
}

function Num(props: NumProps): React.JSX.Element {
  return <RscNum {...props} {...resolveConditions(props)} />;
}

function RelativeTime(props: RelativeTimeProps): React.JSX.Element {
  return <RscRelativeTime {...props} {...resolveConditions(props)} />;
}

/** @internal _gtt - The GT transformation for the component. */
Plural._gtt = 'plural';
Currency._gtt = 'variable-currency';
DateTime._gtt = 'variable-datetime';
Num._gtt = 'variable-number';
RelativeTime._gtt = 'variable-relative-time';

// TODO: serve the server-side RscT implementation here once its import graph
// is RSC-safe; until then it is unavailable from this entrypoint.
export const RscT = Object.assign(
  () => {
    throw new Error(
      'gt-react: RscT cannot be used from gt-react/context in a React Server Component runtime yet.'
    );
  },
  { _gtt: 'translate-server' as const }
);

// ===== Hooks ===== //
// Read-only hooks work in React Server Components: they are plain functions
// over the read-only condition store and i18n config singletons, matching the
// providerless fallback of their hook-based counterparts.

export function useLocale(): string {
  return getReadonlyConditionStoreWithFallback().getLocale();
}

export function useEnableI18n(): boolean {
  return getReadonlyConditionStoreWithFallback().getEnableI18n();
}

export function useDefaultLocale(): string {
  return getI18nConfig().getDefaultLocale();
}

export function useLocales(): string[] {
  return getI18nConfig().getLocales();
}

export function useCustomMapping(): CustomMapping {
  return getI18nConfig().getCustomMapping();
}

export function useFormatLocales(localesProp: string[] = []): string[] {
  const conditionStore = getReadonlyConditionStoreWithFallback();
  return getFormatLocales({
    locale: conditionStore.getLocale(),
    enableI18n: conditionStore.getEnableI18n(),
    localesProp,
  });
}

// Store-backed hooks and client setup cannot work in a React Server
// Component: they need useSyncExternalStore or browser state.

function rscUnavailable(name: string, hint: string): () => never {
  return () => {
    throw new Error(
      `gt-react: ${name} cannot be used in a React Server Component. ${hint}`
    );
  };
}

export const useGT = rscUnavailable(
  'useGT',
  'Render <T> instead, or translate from a client component.'
);
export const useMessages = rscUnavailable(
  'useMessages',
  'Render <T> instead, or translate from a client component.'
);
export const useTranslations = rscUnavailable(
  'useTranslations',
  'Render <T> instead, or translate from a client component.'
);
export const useLocaleSelector = rscUnavailable(
  'useLocaleSelector',
  'Render <LocaleSelector> instead, or use it from a client component.'
);
export const useSetLocale = rscUnavailable(
  'useSetLocale',
  'Setting the locale is a client interaction; use it from a client component.'
);
export const useSetEnableI18n = rscUnavailable(
  'useSetEnableI18n',
  'Setting enableI18n is a client interaction; use it from a client component.'
);
export const initializeGTSPA = rscUnavailable(
  'initializeGTSPA',
  'Single-page-app setup is client-only; use initializeGT for server runtimes.'
);
export const internalInitializeGTSPA = rscUnavailable(
  'internalInitializeGTSPA',
  'Single-page-app setup is client-only; use initializeGT for server runtimes.'
);

// ===== Functions ===== //

export {
  msg,
  decodeMsg,
  decodeOptions,
  derive,
  declareVar,
  decodeVars,
  mFallback,
  gtFallback,
} from 'gt-i18n';
export {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
  defaultRegionCookieName,
} from './cookie-names';

// ===== Exports ===== //

export {
  Branch,
  Currency,
  DateTime,
  Derive,
  getFormatLocales,
  getReactI18nCache,
  getTranslationsSnapshot,
  internalInitializeGTSRA as initializeGT,
  Num,
  Plural,
  RelativeTime,
  setReactI18nCache,
  t,
  Var,
};
