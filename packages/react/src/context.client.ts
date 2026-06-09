'use client';

import type {
  RscBranch as CoreRscBranch,
  RscCurrency as CoreRscCurrency,
  RscDateTime as CoreRscDateTime,
  RscDerive as CoreRscDerive,
  RscNum as CoreRscNum,
  RscPlural as CoreRscPlural,
  RscRelativeTime as CoreRscRelativeTime,
  RscT as CoreRscT,
  RscVar as CoreRscVar,
} from '@generaltranslation/react-core/context-server';

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

export const RscBranch: typeof CoreRscBranch = createRscStub(
  'RscBranch',
  'branch'
);
export const RscPlural: typeof CoreRscPlural = createRscStub(
  'RscPlural',
  'plural'
);
export const RscDerive: typeof CoreRscDerive = createRscStub(
  'RscDerive',
  'derive'
);
export const RscT: typeof CoreRscT = createRscStub('RscT', 'translate-server');
export const RscCurrency: typeof CoreRscCurrency = createRscStub(
  'RscCurrency',
  'variable-currency'
);
export const RscDateTime: typeof CoreRscDateTime = createRscStub(
  'RscDateTime',
  'variable-datetime'
);
export const RscNum: typeof CoreRscNum = createRscStub(
  'RscNum',
  'variable-number'
);
export const RscRelativeTime: typeof CoreRscRelativeTime = createRscStub(
  'RscRelativeTime',
  'variable-relative-time'
);
export const RscVar: typeof CoreRscVar = createRscStub(
  'RscVar',
  'variable-variable'
);

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
  t,
  // ===== Setup ===== //
  internalInitializeGTSRA as initializeGT,
} from '@generaltranslation/react-core/context';
