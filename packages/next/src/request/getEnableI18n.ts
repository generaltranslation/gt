import { getAsyncConditionStore } from '../condition-store/AsyncConditionStore';
import { use } from '../utils/use';
import { memoizeForRequest } from '../utils/requestMemo';

export function getEnableI18n(): Promise<boolean> {
  return memoizeForRequest('enableI18n', () =>
    getAsyncConditionStore().getEnableI18n()
  );
}

export function useEnableI18n(): boolean {
  return use(getEnableI18n());
}
