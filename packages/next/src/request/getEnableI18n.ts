import { getAsyncConditionStore } from '../condition-store/AsyncCondtionStore';
import { use } from '../utils/use';

export function getEnableI18n(): Promise<boolean> {
  return getAsyncConditionStore().getEnableI18n();
}

export function useEnableI18n(): boolean {
  return use(getEnableI18n());
}
