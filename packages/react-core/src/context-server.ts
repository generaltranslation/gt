/**
 * Dedicated server (RSC) entrypoint.
 *
 * Unlike `./context`, nothing in this module's graph calls `createContext` at
 * module load, so it is safe to evaluate in the Next.js `react-server` graph.
 * The components are the `Rsc*` implementations, which read locale/enableI18n
 * from the readonly condition store instead of React context.
 */
import {
  decodeMsg,
  decodeOptions,
  decodeVars,
  declareVar,
  derive,
  gtFallback,
  mFallback,
  msg,
} from 'gt-i18n';
import { getI18nConfig } from 'gt-i18n/internal';

import { RscBranch } from './components/branches/Branch.rsc';
import { RscPlural } from './components/branches/Plural.rsc';
import { RscDerive } from './components/derivation/Derive.rsc';
import { RscT } from './components/translation/T.rsc';
import { RscCurrency } from './components/variables/Currency.rsc';
import { RscDateTime } from './components/variables/DateTime.rsc';
import { RscNum } from './components/variables/Num.rsc';
import { RscRelativeTime } from './components/variables/RelativeTime.rsc';
import { RscVar } from './components/variables/Var.rsc';
import { getReadonlyConditionStoreWithFallback } from './condition-store/singleton-operations';
import { getTranslationsSnapshot } from './functions/helpers/getTranslationsSnapshot';
import { t } from './functions/translation/t';
import { getFormatLocales } from './hooks/format-locales';
import {
  getReactI18nCache,
  setReactI18nCache,
} from './i18n-cache/singleton-operations';
import { internalInitializeGTSRA } from './setup/initializeGTSRA';
import type { JsxTranslationOptions } from './utils/translation/prepareTPure';
import type { RelativeTimeFormatOptions, RenderVariable } from './utils/types';

// ===== Condition hooks (createContext-free) ===== //

function useLocale(): string {
  return getReadonlyConditionStoreWithFallback().getLocale();
}

function useEnableI18n(): boolean {
  return getReadonlyConditionStoreWithFallback().getEnableI18n();
}

function useCustomMapping() {
  return getI18nConfig().getCustomMapping();
}

function useDefaultLocale(): string {
  return getI18nConfig().getDefaultLocale();
}

function useLocales(): readonly string[] {
  return getI18nConfig().getLocales();
}

function useFormatLocales(localesProp?: string[]): string[] {
  const conditionStore = getReadonlyConditionStoreWithFallback();
  return getFormatLocales({
    locale: conditionStore.getLocale(),
    enableI18n: conditionStore.getEnableI18n(),
    localesProp,
  });
}

// ===== Component aliases ===== //
// On the server, `<T>` etc. resolve to their RSC implementations.

const Branch = RscBranch;
const Plural = RscPlural;
const Derive = RscDerive;
const T = RscT;
const GtInternalTranslateJsx = RscT;
const Currency = RscCurrency;
const DateTime = RscDateTime;
const Num = RscNum;
const RelativeTime = RscRelativeTime;
const Var = RscVar;

// ===== Exports ===== //

export {
  // ===== Components ===== //
  Branch,
  Plural,
  Derive,
  GtInternalTranslateJsx,
  T,
  Currency,
  DateTime,
  Num,
  RelativeTime,
  Var,
  RscBranch,
  RscPlural,
  RscDerive,
  RscT,
  RscCurrency,
  RscDateTime,
  RscNum,
  RscRelativeTime,
  RscVar,
  // ===== Hooks ===== //
  useLocale,
  useEnableI18n,
  useCustomMapping,
  useDefaultLocale,
  useLocales,
  getFormatLocales,
  useFormatLocales,
  // ===== Functions ===== //
  msg,
  decodeMsg,
  decodeOptions,
  derive,
  declareVar,
  decodeVars,
  mFallback,
  gtFallback,
  getTranslationsSnapshot,
  getReactI18nCache,
  setReactI18nCache,
  t,
  // ===== Setup ===== //
  internalInitializeGTSRA,
};
export type {
  JsxTranslationOptions,
  RelativeTimeFormatOptions,
  RenderVariable,
};
