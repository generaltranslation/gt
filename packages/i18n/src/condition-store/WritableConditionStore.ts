import type { LocaleCandidates } from '../i18n-cache';
import type { WritableConditionStoreInterface } from '../i18n-cache/types';
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
    this.locale = this.resolveLocale(locale);
  };

  setEnableI18n = (enableI18n: boolean): void => {
    this.enableI18n = enableI18n;
  };
}
