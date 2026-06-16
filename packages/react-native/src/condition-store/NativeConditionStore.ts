import type {
  LocaleCandidates,
  WritableConditionStoreInterface,
  WritableConditionStoreParams,
} from 'gt-i18n/internal/types';
import {
  defaultEnableI18nCookieName as defaultEnableI18nStoreKey,
  defaultLocaleCookieName as defaultLocaleStoreKey,
  defaultRegionCookieName as defaultRegionStoreKey,
} from '@generaltranslation/react-core/internal';
import { getLocale, resolveLocale } from '../utils/getLocale';
import { nativeStoreGet, nativeStoreSet } from '../utils/nativeStore';

export type NativeConditionStoreParams = WritableConditionStoreParams & {
  localeStoreKey?: string;
  regionStoreKey?: string;
  enableI18nStoreKey?: string;
};

/**
 * Condition store implementation for React Native.
 */
export class NativeConditionStore implements WritableConditionStoreInterface {
  private localeStoreKey: string;
  private regionStoreKey: string;
  private enableI18nStoreKey: string;

  constructor(config: NativeConditionStoreParams) {
    this.localeStoreKey = config.localeStoreKey ?? defaultLocaleStoreKey;
    this.regionStoreKey = config.regionStoreKey ?? defaultRegionStoreKey;
    this.enableI18nStoreKey =
      config.enableI18nStoreKey ?? defaultEnableI18nStoreKey;

    this.updateLocale(
      getLocale({ locale: config.locale, localeStoreKey: this.localeStoreKey })
    );
    const region = getInitialRegion(config, this.regionStoreKey);
    if (region !== undefined) {
      this.updateRegion(region);
    }
    this.updateEnableI18n(
      getInitialEnableI18n(config, this.enableI18nStoreKey)
    );
  }

  updateConfig = ({
    localeStoreKey,
    regionStoreKey,
    enableI18nStoreKey,
  }: Pick<
    NativeConditionStoreParams,
    'localeStoreKey' | 'regionStoreKey' | 'enableI18nStoreKey'
  >): void => {
    this.localeStoreKey = localeStoreKey ?? defaultLocaleStoreKey;
    this.regionStoreKey = regionStoreKey ?? defaultRegionStoreKey;
    this.enableI18nStoreKey = enableI18nStoreKey ?? defaultEnableI18nStoreKey;
  };

  getLocale = (): string => {
    return getLocale({ localeStoreKey: this.localeStoreKey });
  };

  setLocale = (locale: LocaleCandidates): void => {
    this.updateLocale(locale);
  };

  getRegion = (): string | undefined => {
    return nativeStoreGet(this.regionStoreKey) || undefined;
  };

  setRegion = (region: string | undefined): void => {
    this.updateRegion(region);
  };

  getEnableI18n = (): boolean => {
    return nativeStoreGet(this.enableI18nStoreKey) !== 'false';
  };

  setEnableI18n = (enableI18n: boolean): void => {
    this.updateEnableI18n(enableI18n);
  };

  updateLocale = (locale: LocaleCandidates): void => {
    nativeStoreSet(this.localeStoreKey, resolveLocale(locale));
  };

  updateRegion = (region: string | undefined): void => {
    nativeStoreSet(this.regionStoreKey, region ?? '');
  };

  updateEnableI18n = (enableI18n: boolean): void => {
    nativeStoreSet(this.enableI18nStoreKey, enableI18n ? 'true' : 'false');
  };
}

function getInitialRegion(
  config: NativeConditionStoreParams,
  regionStoreKey: string
): string | undefined {
  return nativeStoreGet(regionStoreKey) || config.region;
}

function getInitialEnableI18n(
  config: NativeConditionStoreParams,
  enableI18nStoreKey: string
): boolean {
  const storedEnableI18n = nativeStoreGet(enableI18nStoreKey);
  if (storedEnableI18n === null) return config.enableI18n ?? true;
  return storedEnableI18n === 'true';
}
