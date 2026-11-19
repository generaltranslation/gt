// React Server Component context surface. No t or m: they are client-rendered
// (SPA) only, and a server component's useGT() and useMessages() load the
// request locale first.

export { parseLocale } from './functions/parseLocale';

import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import type { CustomMapping } from '@generaltranslation/format';
import { getReadonlyConditionStore } from '@generaltranslation/react-core/pure';
import { getGT, getI18nConfig, getMessages } from 'gt-i18n/internal';
import { getLocale, getRegion, type GT, type M } from 'gt-i18n';
import { use } from 'react';

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
  N,
  Num,
  Plural,
  RelativeTime,
  T,
  Var,
  Tx,
} from '@generaltranslation/react-core/components-rsc';

// ===== Hooks (cannot reference context) ===== //

/** Returns a GT bound to the request locale once its translations load. */
export function useGT(): GT {
  const conditionStore = getReadonlyConditionStore();
  return use(
    getGT({
      locale: conditionStore.getLocale(),
      enableI18n: conditionStore.getEnableI18n(),
    })
  );
}
/** Returns an m bound to the request locale once its translations load. */
export function useMessages(): M {
  const conditionStore = getReadonlyConditionStore();
  return use(
    getMessages({
      locale: conditionStore.getLocale(),
      enableI18n: conditionStore.getEnableI18n(),
    })
  );
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
  return getI18nConfig().getLocaleDirection(locale);
}
export function useLocaleProperties(locale: string) {
  return getI18nConfig().getLocaleProperties(locale);
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

// ===== Translation Helpers ===== //
export { getTranslationsSnapshot } from '@generaltranslation/react-core/pure';

// ===== Functions ===== //
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
  getDefaultLocale,
  getLocaleProperties,
  getLocales,
  resolveCanonicalLocale,
  getVersionId,
} from 'gt-i18n';

// ===== Setup ===== //
export { initializeGTSRA as initializeGT } from './setup/initializeGTSRA';

// ===== Types ===== //
export type {
  BranchProps,
  CurrencyProps,
  DateTimeProps,
  JsxTranslationOptions,
  NProps,
  NumProps,
  PluralProps,
  PreparedT,
  RelativeTimeProps,
  ResolvedCurrencyProps,
  ResolvedDateTimeProps,
  ResolvedNProps,
  ResolvedNumProps,
  ResolvedPluralProps,
  ResolvedRelativeTimeProps,
} from '@generaltranslation/react-core/components-rsc';
export type {
  RelativeTimeFormatOptions,
  RenderVariable,
} from '@generaltranslation/react-core/pure';

export type { SharedGTProviderProps } from './provider/GTProviderProps';
export { GtInternalRuntimeTranslateJsx } from 'gt-i18n/internal';
export type { GT, GTOptions, M, Msg, Part, Placeholder } from 'gt-i18n';
