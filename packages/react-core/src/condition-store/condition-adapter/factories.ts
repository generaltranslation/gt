import type { GTContextType } from '../../context/context';
import { getReadonlyConditionStoreWithFallback } from '../singleton-operations';
import type { ConditionAdapter } from './ConditionAdapter';

export function createSPAConditionAdapter(): ConditionAdapter {
  return {
    mode: 'SPA',
    getLocale: () => {
      return getReadonlyConditionStoreWithFallback().getLocale();
    },
    getEnableI18n: () => {
      return getReadonlyConditionStoreWithFallback().getEnableI18n();
    },
  };
}

export function createSRAConditionAdapter(
  context: GTContextType
): ConditionAdapter {
  const { conditionStore } = context;

  return {
    mode: 'server-render',
    getLocale: () => {
      return conditionStore.getLocale();
    },
    getEnableI18n: () => {
      return conditionStore.getEnableI18n();
    },
  };
}
