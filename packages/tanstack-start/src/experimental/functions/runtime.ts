import {
  getGTInternal,
  getMessagesInternal,
} from 'gt-i18n/internal/experimental';
import type { ReadonlyConditionStoreInterface } from 'gt-i18n/internal/types';
import type { GTFunctionType, Message, MFunctionType } from 'gt-i18n/types';
import { createRuntime } from '../../functions/runtime';

/**
 * The translation functions with locale twins: `getGT()` and `getMessages()`
 * resolve compiled entries from the registered twins (the regular ones read
 * whole locales, which a twin client never loads).
 */
export function createLocaleTwinRuntime(
  getStore: () => ReadonlyConditionStoreInterface
) {
  const runtime = createRuntime(getStore);
  const conditions = () => ({
    locale: runtime.getLocale(),
    enableI18n: runtime.getEnableI18n(),
  });
  return {
    ...runtime,
    getGT: (messages?: Message[]): Promise<GTFunctionType> =>
      getGTInternal(conditions(), messages),
    getMessages: (): Promise<MFunctionType> =>
      getMessagesInternal(conditions()),
  };
}
