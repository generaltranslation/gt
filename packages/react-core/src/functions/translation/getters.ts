import type { GT, M } from 'gt-i18n';
import {
  getGT as getGTFor,
  getMessages as getMessagesFor,
} from 'gt-i18n/internal';
import { readPublishedConditions } from '../../condition-store/publishedConditions';
import { getReadonlyConditionStore } from '../../condition-store/singleton-operations';

/** A mounted provider's conditions, else the condition store's, as in an app with no provider. */
function readConditions(): Parameters<typeof getGTFor>[0] {
  const published = readPublishedConditions();
  if (published) return published;
  const conditionStore = getReadonlyConditionStore();
  return {
    locale: conditionStore.getLocale(),
    enableI18n: conditionStore.getEnableI18n(),
  };
}

/**
 * Returns a tagged-template GT for the locale on screen once its translations
 * have loaded, for code that no component calls, such as a notification
 * handler. In components, use `useGT()`.
 *
 * @example
 * const t = await getGT();
 * notify(t`Download finished`);
 */
export async function getGT(): Promise<GT> {
  return getGTFor(readConditions());
}

/**
 * Returns an m, which renders messages from `msg()`, for the locale on screen
 * once its translations have loaded, for code that no component calls. In
 * components, use `useMessages()`.
 *
 * @example
 * const m = await getMessages();
 * notify(m(downloadFinished));
 */
export async function getMessages(): Promise<M> {
  return getMessagesFor(readConditions());
}
