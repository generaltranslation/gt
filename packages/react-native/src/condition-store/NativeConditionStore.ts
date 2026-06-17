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
  _reload?: ReloadType;
};

export type NativeConditionStoreState = {
  locale: string;
  region: string | undefined;
  enableI18n: boolean;
};

export type ReloadType = (state: NativeConditionStoreState) => void;

/**
 * Condition store implementation for React Native.
 */
export class NativeConditionStore implements WritableConditionStoreInterface {
  private localeStoreKey: string;
  private regionStoreKey: string;
  private enableI18nStoreKey: string;
  private customReload: ReloadType;

  constructor(config: NativeConditionStoreParams) {
    this.customReload = config._reload ?? (() => undefined);
    this.localeStoreKey = config.localeStoreKey ?? defaultLocaleStoreKey;
    this.regionStoreKey = config.regionStoreKey ?? defaultRegionStoreKey;
    this.enableI18nStoreKey =
      config.enableI18nStoreKey ?? defaultEnableI18nStoreKey;

    this.updateLocale(
      config.locale ?? getLocale({ localeStoreKey: this.localeStoreKey })
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
    const nextLocale = resolveLocale(locale);
    this.updateLocale(nextLocale);
    this.reload({ locale: nextLocale });
  };

  getRegion = (): string | undefined => {
    return nativeStoreGet(this.regionStoreKey) || undefined;
  };

  setRegion = (region: string | undefined): void => {
    this.updateRegion(region);
    this.reload({ region });
  };

  getEnableI18n = (): boolean => {
    return nativeStoreGet(this.enableI18nStoreKey) !== 'false';
  };

  setEnableI18n = (enableI18n: boolean): void => {
    this.updateEnableI18n(enableI18n);
    this.reload({ enableI18n });
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

  reload = (state: Partial<NativeConditionStoreState> = {}): void => {
    this.customReload({
      locale: state.locale ?? this.getLocale(),
      region: 'region' in state ? state.region : this.getRegion(),
      enableI18n: state.enableI18n ?? this.getEnableI18n(),
    });
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
