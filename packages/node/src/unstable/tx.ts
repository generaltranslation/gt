import { createTx, type TX } from 'gt-i18n/unstable/internal';
import { getAsyncConditionStore } from '../async-i18n-cache/singleton-operations';

/**
 * Translates in the current withGT() locale, sending a missing translation
 * for runtime translation and waiting for it.
 *
 * @example
 * await withGT('fr', async () => {
 *   await tx`Hello, ${{ name }}!`;
 * });
 */
export const tx: TX = /* @__PURE__ */ createTx(() => {
  const conditionStore = getAsyncConditionStore();
  return {
    locale: conditionStore.getLocale(),
    enableI18n: conditionStore.getEnableI18n(),
  };
});
