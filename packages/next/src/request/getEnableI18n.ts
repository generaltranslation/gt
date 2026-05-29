import { getReadonlyConditionStoreWithFallback } from 'gt-react/context';
import { use } from '../utils/use';

export async function getEnableI18n(): Promise<boolean> {
  return getReadonlyConditionStoreWithFallback().getEnableI18n();
}

export function useEnableI18n(): boolean {
  return use(getEnableI18n());
}
