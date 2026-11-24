// The main entry loads react-native, which only Metro and a device can run.
// This one loads none of it, so tests in Node can map `gt-react-native` to it.
// The package's exports give it the main entry's declarations, so each name
// here takes whatever the real one takes and reads only what it uses.
import {
  getI18nConfig,
  initializeGTForTesting as initializeGT,
} from '@generaltranslation/react-core/pure';
import type { ReactNode } from 'react';

initializeGT();

// ===== Components ===== //
export {
  Select,
  Currency,
  DateTime,
  Derive,
  N,
  Num,
  Ordinal,
  Plural,
  RelativeTime,
  T,
  Var,
} from '@generaltranslation/react-core/components';

/** Renders its children: nothing below it needs a provider here. */
export function GTProvider({ children }: { children?: ReactNode }): ReactNode {
  return children;
}

// ===== Hooks ===== //
export {
  useCustomMapping,
  useDefaultLocale,
  useEnableI18n,
  useFormatLocales,
  useGT,
  useLocale,
  useLocaleDirection,
  useLocaleProperties,
  useLocales,
  useMessages,
  useRegion,
  useSetEnableI18n,
  useSetLocale,
  useSetRegion,
} from '@generaltranslation/react-core/hooks';
export { useLocaleSelector, useRegionSelector } from './hooks/selectors';

// ===== Functions ===== //
export {
  getTranslationsSnapshot,
  getGT,
  getMessages,
} from '@generaltranslation/react-core/pure';
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
  getDefaultLocale,
  getLocaleProperties,
  getLocales,
  resolveCanonicalLocale,
  getVersionId,
} from 'gt-i18n';

/** There is no native store here, so nothing was saved. */
export function getLocaleFromNativeStore(): string | null {
  return null;
}

/** The default locale: there is no device to ask. */
export function getLocale(): string {
  return getI18nConfig().getDefaultLocale();
}

/** There is no device to ask. */
export function getNativeLocales(): string[] {
  return [];
}

export { initializeGT };
