import { getI18nConfig } from 'gt-i18n/internal';
import type {
  LocaleCandidates,
  WritableConditionStoreInterface,
  WritableConditionStoreParams,
} from 'gt-i18n/internal/types';
import { getTranslationsSnapshot } from '@generaltranslation/react-core/context';
import {
  defaultEnableI18nCookieName as defaultEnableI18nStoreKey,
  defaultLocaleCookieName as defaultLocaleStoreKey,
  defaultRegionCookieName as defaultRegionStoreKey,
} from '@generaltranslation/react-core/internal';
import { nativeStoreGet, nativeStoreSet } from '../utils/nativeStore';

type SerializedNativeConditionStoreState = {
  locale: string;
  region: string | undefined;
  enableI18n: boolean;
};

export type ReloadRuntime = (
  state: SerializedNativeConditionStoreState
) => void | Promise<void>;

export type NativeConditionStoreParams = WritableConditionStoreParams & {
  localeStoreKey?: string;
  regionStoreKey?: string;
  enableI18nStoreKey?: string;
  reload?: ReloadRuntime;
};

/**
 * Condition store implementation for React Native.
 */
export class NativeConditionStore implements WritableConditionStoreInterface {
  private localeStoreKey: string;
  private regionStoreKey: string;
  private enableI18nStoreKey: string;
  private reloadRuntime: ReloadRuntime;

  constructor(config: NativeConditionStoreParams) {
    this.localeStoreKey = config.localeStoreKey ?? defaultLocaleStoreKey;
    this.regionStoreKey = config.regionStoreKey ?? defaultRegionStoreKey;
    this.enableI18nStoreKey =
      config.enableI18nStoreKey ?? defaultEnableI18nStoreKey;
    this.reloadRuntime = config.reload ?? (() => {});

    this.updateLocale(config.locale);
    if (config.region !== undefined) {
      this.updateRegion(config.region);
    }
    this.updateEnableI18n(config.enableI18n ?? true);
  }

  updateConfig = ({
    localeStoreKey,
    regionStoreKey,
    enableI18nStoreKey,
    reload,
  }: Pick<
    NativeConditionStoreParams,
    'localeStoreKey' | 'regionStoreKey' | 'enableI18nStoreKey' | 'reload'
  >): void => {
    this.localeStoreKey = localeStoreKey ?? defaultLocaleStoreKey;
    this.regionStoreKey = regionStoreKey ?? defaultRegionStoreKey;
    this.enableI18nStoreKey = enableI18nStoreKey ?? defaultEnableI18nStoreKey;
    this.reloadRuntime = reload ?? (() => {});
  };

  getLocale = (): string => {
    return resolveLocale(nativeStoreGet(this.localeStoreKey));
  };

  setLocale = (locale: LocaleCandidates): void => {
    this.updateLocale(locale);
    void this.reload();
  };

  getRegion = (): string | undefined => {
    return nativeStoreGet(this.regionStoreKey) || undefined;
  };

  setRegion = (region: string | undefined): void => {
    this.updateRegion(region);
    void this.reload();
  };

  getEnableI18n = (): boolean => {
    return nativeStoreGet(this.enableI18nStoreKey) !== 'false';
  };

  setEnableI18n = (enableI18n: boolean): void => {
    this.updateEnableI18n(enableI18n);
    void this.reload();
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

  reload = async (): Promise<void> => {
    const state = {
      locale: this.getLocale(),
      region: this.getRegion(),
      enableI18n: this.getEnableI18n(),
    };

    await getTranslationsSnapshot(state.locale);
    await this.reloadRuntime(state);
  };
}

function resolveLocale(candidates?: LocaleCandidates | null): string {
  const i18nConfig = getI18nConfig();
  return (
    i18nConfig.determineLocale(candidates ?? undefined) ||
    i18nConfig.getDefaultLocale()
  );
}
