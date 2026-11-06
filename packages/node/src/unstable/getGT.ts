import type { GT } from 'gt-i18n/unstable';
import { getGT as getGTForLocale } from 'gt-i18n/unstable/internal';
import { getAsyncConditionStore } from '../async-i18n-cache/singleton-operations';

/**
 * Loads the translations for the current withGT() locale, then returns a GT
 * bound to that locale.
 *
 * @example
 * await withGT('fr', async () => {
 *   const gt = await getGT();
 *   gt`Hello, ${{ name }}!`;
 * });
 */
export function getGT(): Promise<GT> {
  const conditionStore = getAsyncConditionStore();
  return getGTForLocale({
    locale: conditionStore.getLocale(),
    enableI18n: conditionStore.getEnableI18n(),
  });
}
