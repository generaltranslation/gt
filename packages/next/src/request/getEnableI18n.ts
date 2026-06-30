import { getAsyncConditionStore } from '../condition-store/AsyncConditionStore';
import { ensureGTServerInitialized } from '../setup/ensureGTServerInitialized';
import { use } from '../utils/use';

export function getEnableI18n(): Promise<boolean> {
  ensureGTServerInitialized();
  return getAsyncConditionStore().getEnableI18n();
}

export function useEnableI18n(): boolean {
  return use(getEnableI18n());
}
