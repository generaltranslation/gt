'use client';

export { initializeGTSPA } from './setup/initializeGTSPA';
export { useLocaleSelector } from './components/useLocaleSelector';
export { useSetLocale, useSetEnableI18n } from './hooks/conditions-store';
export {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
  defaultRegionCookieName,
} from './cookie-names';

function createRscStub<T>(name: string, _gtt: string): T {
  return Object.assign(
    () => {
      throw new Error(
        `gt-react: ${name} cannot be used in a client environment.`
      );
    },
    { _gtt }
  ) as unknown as T;
}

export const RscBranch: typeof import('./components/branches/Branch').RscBranch =
  createRscStub('RscBranch', 'branch');
export const RscPlural: typeof import('./components/branches/Plural').RscPlural =
  createRscStub('RscPlural', 'plural');
export const RscDerive: typeof import('./components/derivation/Derive').RscDerive =
  createRscStub('RscDerive', 'derive');
export const RscT: typeof import('./components/translation/T').RscT =
  createRscStub('RscT', 'translate-server');
export const RscCurrency: typeof import('./components/variables/Currency').RscCurrency =
  createRscStub('RscCurrency', 'variable-currency');
export const RscDateTime: typeof import('./components/variables/DateTime').RscDateTime =
  createRscStub('RscDateTime', 'variable-datetime');
export const RscNum: typeof import('./components/variables/Num').RscNum =
  createRscStub('RscNum', 'variable-number');
export const RscRelativeTime: typeof import('./components/variables/RelativeTime').RscRelativeTime =
  createRscStub('RscRelativeTime', 'variable-relative-time');
export const RscVar: typeof import('./components/variables/Var').RscVar =
  createRscStub('RscVar', 'variable-variable');

// ===== Components ===== //
export { LocaleSelector } from './components/LocaleSelector';
export { BrowserGTProvider as GTProvider } from './provider/BrowserGTProvider';

export {
  // ===== Components ===== //
  Branch,
  Plural,
  Derive,
  GtInternalTranslateJsx,
  T,
  Currency,
  DateTime,
  RelativeTime,
  Var,
  Num,
  // ===== Hooks ===== //
  useLocale,
  useCustomMapping,
  useDefaultLocale,
  useEnableI18n,
  useLocales,
  getFormatLocales,
  useFormatLocales,
  useGT,
  useMessages,
  useTranslations,
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
  setReadonlyConditionStore,
  t,
  // ===== Setup ===== //
  internalInitializeGTSRA as initializeGT,
} from '@generaltranslation/react-core/context';
