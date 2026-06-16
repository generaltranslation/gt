import type { LocaleCandidates } from 'gt-i18n/internal/types';
import {
  defaultEnableI18nCookieName as defaultEnableI18nStoreKey,
  defaultLocaleCookieName as defaultLocaleStoreKey,
  defaultRegionCookieName as defaultRegionStoreKey,
} from '@generaltranslation/react-core/internal';
import { getNativeLocales } from '../utils/getNativeLocales';
import { nativeStoreGet } from '../utils/nativeStore';
import {
  NativeConditionStore,
  type NativeConditionStoreParams,
} from './NativeConditionStore';
import {
  getNativeConditionStore,
  isNativeConditionStoreInitialized,
  setNativeConditionStore,
} from './singleton-operations';

export type CreateNativeConditionStoreParams = Omit<
  NativeConditionStoreParams,
  'locale' | 'region' | 'enableI18n'
> & {
  locale?: LocaleCandidates;
  region?: string;
  enableI18n?: boolean;
};

export function createOrUpdateNativeConditionStore(
  config: CreateNativeConditionStoreParams
) {
  const locale = determineLocale(config);
  const region = determineRegion(config);
  const enableI18n = determineEnableI18n(config);

  if (isNativeConditionStoreInitialized()) {
    const conditionStore = getNativeConditionStore();
    conditionStore.updateConfig(config);
    conditionStore.updateLocale(locale);
    if (region !== undefined) conditionStore.updateRegion(region);
    conditionStore.updateEnableI18n(enableI18n);
    return conditionStore;
  }

  const conditionStore = new NativeConditionStore({
    ...config,
    locale,
    region,
    enableI18n,
  });
  setNativeConditionStore(conditionStore);
  return conditionStore;
}

function determineLocale({
  locale,
  localeStoreKey = defaultLocaleStoreKey,
}: CreateNativeConditionStoreParams): string[] {
  const candidates: string[] = [];
  pushLocaleCandidates(candidates, nativeStoreGet(localeStoreKey));
  pushLocaleCandidates(candidates, locale);
  candidates.push(...getNativeLocales());
  return candidates;
}

function pushLocaleCandidates(
  target: string[],
  locale: LocaleCandidates | null
) {
  if (!locale) return;
  if (Array.isArray(locale)) {
    target.push(...locale);
    return;
  }
  target.push(locale);
}

function determineRegion({
  region,
  regionStoreKey = defaultRegionStoreKey,
}: CreateNativeConditionStoreParams): string | undefined {
  return nativeStoreGet(regionStoreKey) || region;
}

function determineEnableI18n({
  enableI18n,
  enableI18nStoreKey = defaultEnableI18nStoreKey,
}: CreateNativeConditionStoreParams): boolean {
  const storedEnableI18n = nativeStoreGet(enableI18nStoreKey);
  if (storedEnableI18n === null) return enableI18n ?? true;
  return storedEnableI18n === 'true';
}
