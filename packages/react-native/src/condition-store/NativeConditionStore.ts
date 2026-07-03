import type {
  LocaleCandidates,
  WritableConditionStoreInterface,
  WritableConditionStoreParams,
} from 'gt-i18n/internal/types';
import { getI18nConfig } from '@generaltranslation/react-core/pure';
import { getLocale } from '../utils/getLocale';
import {
  getInitialEnableI18n,
  getInitialRegion,
} from '../utils/getInitialNativeConditions';
import { nativeStoreGet, nativeStoreSet } from '../utils/nativeStore';
import { resolveLocale } from '../utils/resolveLocale';

export type NativeConditionStoreParams = WritableConditionStoreParams & {
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
  private customReload: ReloadType;

  constructor(config: NativeConditionStoreParams) {
    this.customReload = config._reload ?? (() => undefined);

    this.updateLocale(config.locale ?? getLocale());
    const region = getInitialRegion({
      region: config.region,
    });
    if (region !== undefined) {
      this.updateRegion(region);
    }
    this.updateEnableI18n(
      getInitialEnableI18n({
        enableI18n: config.enableI18n,
      })
    );
  }

  getLocale = (): string => {
    return getLocale();
  };

  setLocale = (locale: LocaleCandidates): void => {
    const nextLocale = resolveLocale(locale);
    nativeStoreSet(getLocaleStoreKey(), nextLocale);
    this.reload({ locale: nextLocale });
  };

  getRegion = (): string | undefined => {
    return nativeStoreGet(getRegionStoreKey()) || undefined;
  };

  setRegion = (region: string | undefined): void => {
    this.updateRegion(region);
    this.reload({ region });
  };

  getEnableI18n = (): boolean => {
    return nativeStoreGet(getEnableI18nStoreKey()) !== 'false';
  };

  setEnableI18n = (enableI18n: boolean): void => {
    this.updateEnableI18n(enableI18n);
    this.reload({ enableI18n });
  };

  updateLocale = (locale: LocaleCandidates): void => {
    nativeStoreSet(getLocaleStoreKey(), resolveLocale(locale));
  };

  updateRegion = (region: string | undefined): void => {
    nativeStoreSet(getRegionStoreKey(), region ?? '');
  };

  updateEnableI18n = (enableI18n: boolean): void => {
    nativeStoreSet(getEnableI18nStoreKey(), enableI18n ? 'true' : 'false');
  };

  reload = (state: Partial<NativeConditionStoreState> = {}): void => {
    this.customReload({
      locale: state.locale ?? this.getLocale(),
      region: 'region' in state ? state.region : this.getRegion(),
      enableI18n: state.enableI18n ?? this.getEnableI18n(),
    });
  };
}

function getLocaleStoreKey(): string {
  return getI18nConfig().getLocaleCookieName();
}

function getRegionStoreKey(): string {
  return getI18nConfig().getRegionCookieName();
}

function getEnableI18nStoreKey(): string {
  return getI18nConfig().getEnableI18nCookieName();
}
