import type { LocaleCandidates } from '../i18n-manager';
import type { WritableConditionStoreInterface as WritableConditionStoreContract } from '../i18n-manager/types';
import {
  ReadonlyConditionStore,
  type ReadonlyConditionStoreParams,
} from './ReadonlyConditionStore';

export type WritableConditionStoreParams = ReadonlyConditionStoreParams;

export class WritableConditionStore
  extends ReadonlyConditionStore
  implements WritableConditionStoreContract
{
  setLocale = (locale: LocaleCandidates): void => {
    console.log('WritableConditionStore.setLocale', locale);
    this.locale = this.resolveLocale(locale);
  };

  setEnableI18n = (enableI18n: boolean): void => {
    this.enableI18n = enableI18n;
  };
}
