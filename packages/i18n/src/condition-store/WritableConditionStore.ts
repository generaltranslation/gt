import type { LocaleCandidates } from '../i18n-cache';
import type { WritableConditionStoreInterface } from '../i18n-cache/types';
import { getI18nConfig } from '../i18n-config/singleton-operations';
import {
  ReadonlyConditionStore,
  type ReadonlyConditionStoreParams,
} from './ReadonlyConditionStore';

export type WritableConditionStoreParams = ReadonlyConditionStoreParams;

export class WritableConditionStore
  extends ReadonlyConditionStore
  implements WritableConditionStoreInterface
{
  setLocale = (locale: LocaleCandidates): void => {
    const i18nConfig = getI18nConfig();
    this.locale =
      i18nConfig.determineLocale(locale) || i18nConfig.getDefaultLocale();
  };

  setEnableI18n = (enableI18n: boolean): void => {
    this.enableI18n = enableI18n;
  };
}
