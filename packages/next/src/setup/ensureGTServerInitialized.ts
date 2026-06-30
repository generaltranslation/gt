import { isI18nConfigInitialized } from 'gt-i18n/internal';
import { isAsyncConditionStoreInitialized } from '../condition-store/AsyncConditionStore';
import { initializeGT } from './initGT.rsc';

export function ensureGTServerInitialized(): void {
  if (isI18nConfigInitialized() && isAsyncConditionStoreInitialized()) {
    return;
  }

  initializeGT();
}
