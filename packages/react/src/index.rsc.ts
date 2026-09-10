// React Server Component context surface.

export { parseLocale } from './functions/parseLocale';

import { createDiagnosticMessage } from 'generaltranslation/internal';
import { CustomMapping } from 'generaltranslation/types';
import {
  getGT,
  getI18nConfig,
  getMessages,
  getTranslations,
} from 'gt-i18n/internal';
import { getLocale, getRegion } from 'gt-i18n';
import { use, type ReactNode } from 'react';
import {
  T as RscT,
  Tx as RscTx,
} from '@generaltranslation/react-core/components-rsc';
import type { TxProps } from './utils/TxProps';

type TProps = Omit<Parameters<typeof RscT>[0], '_locale' | '_enableI18n'>;

function getRscTranslationConditions(locale: string = getLocale()) {
  return {
    _locale: getI18nConfig().resolveSupportedLocale(locale),
    _enableI18n: true,
  };
}

// ===== Error for client components ===== //
function failClientComponent(componentName: string) {
  throw new Error(
    createDiagnosticMessage({
      source: 'gt-react',
      severity: 'Error',
      whatHappened: `${componentName} cannot be consumed via the RSC entry point`,
      fix: 'Import this component from a client or server runtime entry point instead.',
    })
  );
}

export function GTProvider() {
  return failClientComponent('GTProvider');
}
export function LocaleSelector() {
  return failClientComponent('LocaleSelector');
}
export function RegionSelector() {
  return failClientComponent('RegionSelector');
}

// ===== Components ===== //
export {
  Branch,
  Currency,
  DateTime,
  Derive,
  Num,
  Plural,
  RelativeTime,
  Var,
} from '@generaltranslation/react-core/components-rsc';

export async function T(props: TProps): Promise<ReactNode> {
  return RscT({
    ...props,
    ...getRscTranslationConditions(),
  });
}

/** @internal _gtt - The GT transformation for the component. */
T._gtt = 'translate-server';

export async function Tx({ locale, ...props }: TxProps): Promise<ReactNode> {
  return RscTx({
    ...props,
    ...getRscTranslationConditions(locale || getLocale()),
  });
}

/** @internal _gtt - The GT transformation for the component. */
Tx._gtt = 'translate-runtime';

// ===== Hooks (cannot reference context) ===== //

export function useGT() {
  return use(getGT());
}
export function useTranslations(rootId?: string) {
  return use(getTranslations(rootId));
}
export function useMessages() {
  return use(getMessages());
}
export function useLocale() {
  return getLocale();
}
export function useRegion() {
  return getRegion();
}
export function useLocales() {
  return getI18nConfig().getLocales();
}
export function useLocaleDirection(locale: string) {
  return getI18nConfig().getGTClass().getLocaleDirection(locale);
}
export function useLocaleProperties(locale: string) {
  return getI18nConfig().getGTClass().getLocaleProperties(locale);
}
export function useDefaultLocale(): string {
  return getI18nConfig().getDefaultLocale();
}
export function useCustomMapping(): CustomMapping {
  return getI18nConfig().getCustomMapping();
}
// ===== Internal Components ===== //
export {
  T as GtInternalTranslateJsx,
  GtInternalVar,
} from '@generaltranslation/react-core/components-rsc';

// ===== Render Helpers ===== //
export { createRenderPipeline } from '@generaltranslation/react-core/components-rsc';

// ===== Translation Helpers ===== //
export {
  getFormatLocales,
  getTranslationsSnapshot,
  t,
} from '@generaltranslation/react-core/components-rsc';

// ===== Internal ===== //
export {
  getReactI18nCache,
  setReactI18nCache,
} from '@generaltranslation/react-core/components-rsc';

// ===== Functions ===== //
export {
  decodeMsg,
  decodeOptions,
  decodeVars,
  declareVar,
  derive,
  gtFallback,
  mFallback,
  msg,
  getDefaultLocale,
  getLocaleProperties,
  getLocales,
  resolveCanonicalLocale,
  getVersionId,
} from '@generaltranslation/react-core/pure';

// ===== Setup ===== //
export { internalInitializeGTSRA as initializeGT } from '@generaltranslation/react-core/pure';

// ===== Types ===== //
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
} from '@generaltranslation/react-core/components-rsc';

export type {
  RenderPipeline,
  RenderPreparedT,
} from '@generaltranslation/react-core/pure';

export type { SharedGTProviderProps } from './provider/GTProviderProps';
export {
  GtInternalRuntimeTranslateJsx,
  GtInternalRuntimeTranslateString,
} from 'gt-i18n/internal';
export type {
  GTTranslationOptions,
  RuntimeTranslationOptions,
} from 'gt-i18n/types';
export type {
  SyncResolutionFunction,
  SyncResolutionFunctionWithFallback,
} from 'gt-i18n/types';

// ===== Singletons ===== //
export {
  ReactI18nCache,
  type ReactI18nCacheParams,
} from '@generaltranslation/react-core/pure';
