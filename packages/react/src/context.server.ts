'server-only';

export {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
  defaultRegionCookieName,
} from './cookie-names';

function throwServerOnlyBoundaryError(name: string): never {
  throw new Error(
    `gt-react: ${name} is not available from the react-server context entry.`
  );
}

export function GTProvider(): never {
  return throwServerOnlyBoundaryError('GTProvider');
}

export function LocaleSelector(): never {
  return throwServerOnlyBoundaryError('LocaleSelector');
}

export function initializeGTSPA(): never {
  return throwServerOnlyBoundaryError('initializeGTSPA');
}

export function internalInitializeGTSPA(): never {
  return throwServerOnlyBoundaryError('internalInitializeGTSPA');
}

export function useLocaleSelector(): never {
  return throwServerOnlyBoundaryError('useLocaleSelector');
}

export function useSetLocale(): never {
  return throwServerOnlyBoundaryError('useSetLocale');
}

export function useSetEnableI18n(): never {
  return throwServerOnlyBoundaryError('useSetEnableI18n');
}

export function useGT(): never {
  return throwServerOnlyBoundaryError('useGT');
}

export function useMessages(): never {
  return throwServerOnlyBoundaryError('useMessages');
}

export function useTranslations(): never {
  return throwServerOnlyBoundaryError('useTranslations');
}

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
  RscBranch,
  RscPlural,
  RscDerive,
  RscT,
  RscCurrency,
  RscDateTime,
  RscNum,
  RscRelativeTime,
  RscVar,
} from '@generaltranslation/react-core/rsc';
