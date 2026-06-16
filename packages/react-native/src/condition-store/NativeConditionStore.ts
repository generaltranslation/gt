import { getI18nConfig } from 'gt-i18n/internal';
import type {
  LocaleCandidates,
  WritableConditionStoreInterface,
  WritableConditionStoreParams,
} from 'gt-i18n/internal/types';
import { getTranslationsSnapshot } from '@generaltranslation/react-core/context';
import {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
  defaultRegionCookieName,
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
  localeCookieName?: string;
  regionCookieName?: string;
  enableI18nCookieName?: string;
  reload?: ReloadRuntime;
};

/**
 * Condition store implementation for React Native.
 */
export class NativeConditionStore implements WritableConditionStoreInterface {
  private localeStoreName: string;
  private regionStoreName: string;
  private enableI18nStoreName: string;
  private reloadRuntime: ReloadRuntime;

  constructor(config: NativeConditionStoreParams) {
    this.localeStoreName = config.localeCookieName ?? defaultLocaleCookieName;
    this.regionStoreName = config.regionCookieName ?? defaultRegionCookieName;
    this.enableI18nStoreName =
      config.enableI18nCookieName ?? defaultEnableI18nCookieName;
    this.reloadRuntime = config.reload ?? (() => {});

    this.updateLocale(config.locale);
    if (config.region !== undefined) {
      this.updateRegion(config.region);
    }
    this.updateEnableI18n(config.enableI18n ?? true);
  }

  updateConfig = ({
    localeCookieName,
    regionCookieName,
    enableI18nCookieName,
    reload,
  }: Pick<
    NativeConditionStoreParams,
    'localeCookieName' | 'regionCookieName' | 'enableI18nCookieName' | 'reload'
  >): void => {
    this.localeStoreName = localeCookieName ?? defaultLocaleCookieName;
    this.regionStoreName = regionCookieName ?? defaultRegionCookieName;
    this.enableI18nStoreName =
      enableI18nCookieName ?? defaultEnableI18nCookieName;
    this.reloadRuntime = reload ?? (() => {});
  };

  getLocale = (): string => {
    return resolveLocale(nativeStoreGet(this.localeStoreName));
  };

  setLocale = (locale: LocaleCandidates): void => {
    this.updateLocale(locale);
    void this.reload();
  };

  getRegion = (): string | undefined => {
    return nativeStoreGet(this.regionStoreName) || undefined;
  };

  setRegion = (region: string | undefined): void => {
    this.updateRegion(region);
    void this.reload();
  };

  getEnableI18n = (): boolean => {
    return nativeStoreGet(this.enableI18nStoreName) !== 'false';
  };

  setEnableI18n = (enableI18n: boolean): void => {
    this.updateEnableI18n(enableI18n);
    void this.reload();
  };

  updateLocale = (locale: LocaleCandidates): void => {
    nativeStoreSet(this.localeStoreName, resolveLocale(locale));
  };

  updateRegion = (region: string | undefined): void => {
    nativeStoreSet(this.regionStoreName, region ?? '');
  };

  updateEnableI18n = (enableI18n: boolean): void => {
    nativeStoreSet(this.enableI18nStoreName, enableI18n ? 'true' : 'false');
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
