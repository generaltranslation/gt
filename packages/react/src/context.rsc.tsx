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
// - Client components (GTProvider, LocaleSelector) are
//   wrapped through a dedicated 'use client' boundary entry. The build keeps
//   that entry external so the directive survives (see tsdown.config.mts).
// - <T> and GtInternalTranslateJsx render through the hook-free RscT
//   implementation from react-core/context-rsc.
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
  RscT,
  setReactI18nCache,
  t,
  Var,
  type CurrencyProps,
  type DateTimeProps,
  type NumProps,
  type PluralProps,
  type RelativeTimeProps,
  type JsxTranslationOptions,
} from '@generaltranslation/react-core/context-rsc';
import { getI18nConfig } from 'gt-i18n/internal';
import type { CustomMapping } from 'generaltranslation/types';
import type { ReactNode } from 'react';
import {
  GTProvider as ClientGTProvider,
  LocaleSelector as ClientLocaleSelector,
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

export async function T({
  children,
  ...params
}: {
  children?: ReactNode;
} & JsxTranslationOptions): Promise<ReactNode> {
  const conditionStore = getReadonlyConditionStoreWithFallback();
  return RscT({
    children,
    locale: conditionStore.getLocale(),
    enableI18n: conditionStore.getEnableI18n(),
    ...params,
  });
}

export async function GtInternalTranslateJsx({
  children,
  ...params
}: {
  children?: ReactNode;
} & JsxTranslationOptions): Promise<ReactNode> {
  const conditionStore = getReadonlyConditionStoreWithFallback();
  return RscT({
    children,
    locale: conditionStore.getLocale(),
    enableI18n: conditionStore.getEnableI18n(),
    ...params,
  });
}

/** @internal _gtt - The GT transformation for the component. */
T._gtt = 'translate-server';
GtInternalTranslateJsx._gtt = 'translate-server-automatic';

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
