import type {
  LocaleCandidates,
  WritableConditionStoreInterface,
  WritableConditionStoreParams,
} from 'gt-i18n/internal';
import { getI18nConfig } from '@generaltranslation/react-core/pure';
import { getLocale } from '../utils/getLocale';
import {
  getInitialEnableI18n,
  getInitialRegion,
} from '../utils/getInitialNativeConditions';
import { nativeStoreSet } from '../utils/nativeStore';
import { resolveLocale } from '../utils/resolveLocale';

export type NativeConditionStoreParams = WritableConditionStoreParams & {
  _reload?: ReloadType;
};

export type NativeConditionStoreState = {
  locale: string;
  region: string | undefined;
  enableI18n: boolean;
};

/** Receives the one condition a setter changed. */
export type ReloadType = (change: Partial<NativeConditionStoreState>) => void;

/**
 * Condition store implementation for React Native.
 */
export class NativeConditionStore implements WritableConditionStoreInterface {
  private customReload: ReloadType;
  // Android writes native storage asynchronously, so a read that follows a write can return the old value.
  private locale: string;
  private region: string | undefined;
  private enableI18n: boolean;

  constructor(config: NativeConditionStoreParams) {
    this.customReload = config._reload ?? (() => undefined);

    this.locale = resolveLocale(config.locale ?? getLocale());
    nativeStoreSet(getLocaleStoreKey(), this.locale);
    // An explicit undefined is a cleared region. It is saved like any other, so that storage does not keep the region it replaced.
    if ('region' in config) {
      this.updateRegion(config.region);
    } else {
      this.region = getInitialRegion({});
    }
    this.enableI18n = getInitialEnableI18n({
      enableI18n: config.enableI18n,
    });
    this.updateEnableI18n(this.enableI18n);
  }

  getLocale = (): string => {
    return this.locale;
  };

  setLocale = (locale: LocaleCandidates): void => {
    this.updateLocale(locale);
    this.customReload({ locale: this.locale });
  };

  getRegion = (): string | undefined => {
    return this.region || undefined;
  };

  setRegion = (region: string | undefined): void => {
    this.updateRegion(region);
    this.customReload({ region });
  };

  getEnableI18n = (): boolean => {
    return this.enableI18n;
  };

  setEnableI18n = (enableI18n: boolean): void => {
    this.updateEnableI18n(enableI18n);
    this.customReload({ enableI18n });
  };

  updateLocale = (locale: LocaleCandidates): void => {
    this.locale = resolveLocale(locale);
    nativeStoreSet(getLocaleStoreKey(), this.locale);
  };

  updateRegion = (region: string | undefined): void => {
    this.region = region;
    nativeStoreSet(getRegionStoreKey(), region ?? '');
  };

  updateEnableI18n = (enableI18n: boolean): void => {
    this.enableI18n = enableI18n;
    nativeStoreSet(getEnableI18nStoreKey(), enableI18n ? 'true' : 'false');
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
