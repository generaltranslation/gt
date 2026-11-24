import { getWritableConditionStore } from '../condition-store/singleton-operations';
import { loadCreateGTParams, lookupCachedTranslation } from './cachedGT';
import { createMessages, type M } from './messages';

/** Global m reading the current locale from the condition store. */
export const m: M = /* @__PURE__ */ createMessages({
  getLocale: () => getWritableConditionStore().getLocale(),
  getEnableI18n: () => getWritableConditionStore().getEnableI18n(),
  lookupTranslation: lookupCachedTranslation,
});

/** Loads the locale's translations, then returns an m bound to that locale. */
export async function getMessages(
  conditions: Parameters<typeof loadCreateGTParams>[0]
): Promise<M> {
  return createMessages(await loadCreateGTParams(conditions));
}
