import {
  getGTInternal,
  getMessagesInternal,
  getTranslationsInternal,
} from 'gt-i18n/internal';
import type { Message } from 'gt-i18n/types';
import { getConditionStore } from '../condition-store/singleton';

/** Return the locale associated with the current server request. */
export function getLocale(): string {
  return getConditionStore().getLocale();
}

/** Return whether internationalization is enabled for the current request. */
export function getEnableI18n(): boolean {
  return getConditionStore().getEnableI18n();
}

/** Return a string translation function for the current server request. */
export async function getGT(messages?: Message[]) {
  const conditionStore = getConditionStore();
  return getGTInternal(
    {
      locale: conditionStore.getLocale(),
      enableI18n: conditionStore.getEnableI18n(),
    },
    messages
  );
}

/** Return a registered-message translation function for the current request. */
export async function getMessages() {
  const conditionStore = getConditionStore();
  return getMessagesInternal({
    locale: conditionStore.getLocale(),
    enableI18n: conditionStore.getEnableI18n(),
  });
}

/** Return a dictionary translation function for the current server request. */
export async function getTranslations(rootId?: string) {
  const conditionStore = getConditionStore();
  return getTranslationsInternal({
    locale: conditionStore.getLocale(),
    enableI18n: conditionStore.getEnableI18n(),
    rootId,
  });
}
