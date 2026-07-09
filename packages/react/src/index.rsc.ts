// React Server Component context surface.

import { createDiagnosticMessage } from 'generaltranslation/internal';
import { CustomMapping } from 'generaltranslation/types';
import {
  getGT,
  getI18nConfig,
  getMessages,
  getTranslations,
} from 'gt-i18n/internal';
import { getLocale, getRegion } from 'gt-i18n';
import { use } from 'react';

type InitializeGTSPA = typeof import('./setup/initializeGTSPA').initializeGTSPA;
type UseLocaleSelector =
  typeof import('./components/useLocaleSelector').useLocaleSelector;
type UseRegionSelector =
  typeof import('./components/useRegionSelector').useRegionSelector;
type UseSetLocale = typeof import('./hooks/conditions-store').useSetLocale;
type UseSetRegion = typeof import('./hooks/conditions-store').useSetRegion;
type UseSetEnableI18n =
  typeof import('./hooks/conditions-store').useSetEnableI18n;

// ===== Error for client exports ===== //
function failClientExport(exportName: string): never {
  throw new Error(
    createDiagnosticMessage({
      source: 'gt-react',
      severity: 'Error',
      whatHappened: `${exportName} cannot be consumed via the RSC entry point`,
      fix: 'Import this API from a client or server runtime entry point instead.',
    })
  );
}

export function GTProvider() {
  return failClientExport('GTProvider');
}
export function LocaleSelector() {
  return failClientExport('LocaleSelector');
}
export function RegionSelector() {
  return failClientExport('RegionSelector');
}
export const initializeGTSPA: InitializeGTSPA = async () => {
  return failClientExport('initializeGTSPA');
};
export const useLocaleSelector: UseLocaleSelector = (_locales) => {
  return failClientExport('useLocaleSelector');
};
export const useRegionSelector: UseRegionSelector = (_options) => {
  return failClientExport('useRegionSelector');
};
export const useSetLocale: UseSetLocale = () => {
  return failClientExport('useSetLocale');
};
export const useSetRegion: UseSetRegion = () => {
  return failClientExport('useSetRegion');
};
export const useSetEnableI18n: UseSetEnableI18n = () => {
  return failClientExport('useSetEnableI18n');
};

// ===== Components ===== //
export {
  Branch,
  Currency,
  DateTime,
  Derive,
  Num,
  Plural,
  RelativeTime,
  T,
  Var,
  Tx,
} from '@generaltranslation/react-core/components-rsc';

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
export function useEnableI18n(): boolean {
  return failClientExport('useEnableI18n');
}
export function useLocales() {
  return getI18nConfig().getLocales();
}
export function useFormatLocales(_localesProp?: string[]): string[] {
  return failClientExport('useFormatLocales');
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
