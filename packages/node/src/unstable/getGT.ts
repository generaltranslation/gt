import type { GT, M } from 'gt-i18n/unstable';
import {
  getGT as getGTForLocale,
  getMessages as getMessagesForLocale,
} from 'gt-i18n/unstable/internal';
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

/**
 * Loads the translations for the current withGT() locale, then returns an m
 * bound to that locale, which renders messages from msg().
 *
 * @example
 * const greeting = msg`Hello, ${{ name }}!`;
 * await withGT('fr', async () => {
 *   const m = await getMessages();
 *   m(greeting);
 * });
 */
export function getMessages(): Promise<M> {
  const conditionStore = getAsyncConditionStore();
  return getMessagesForLocale({
    locale: conditionStore.getLocale(),
    enableI18n: conditionStore.getEnableI18n(),
  });
}
