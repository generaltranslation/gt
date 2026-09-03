import { createGlobalSingleton } from '../globals/createGlobalSingleton';
import type { I18nRuntime } from './types';

const i18nRuntimeSingleton =
  /* @__PURE__ */ createGlobalSingleton<I18nRuntime>({
    namespace: 'i18n',
    key: 'i18nRuntime',
    source: 'gt-i18n',
    notInitialized: () => 'I18n runtime is not initialized.',
  });

export function getI18nRuntime(): I18nRuntime {
  return i18nRuntimeSingleton.get();
}

export const setI18nRuntime = i18nRuntimeSingleton.set;
