import { createServerOnlyFn } from '@tanstack/react-start';
import {
  getGTInternal,
  getMessagesInternal,
  getTranslationsInternal,
} from 'gt-i18n/internal';
import type { Message } from 'gt-i18n/types';
import { getConditionStore } from '../condition-store/singleton';

/** Return the locale associated with the current server request. */
export const getLocale = createServerOnlyFn((): string => {
  return getConditionStore().getLocale();
});

/** Return whether internationalization is enabled for the current request. */
export const getEnableI18n = createServerOnlyFn((): boolean => {
  return getConditionStore().getEnableI18n();
});

/** Return a string translation function for the current server request. */
export const getGT = createServerOnlyFn(async (messages?: Message[]) => {
  const conditionStore = getConditionStore();
  return getGTInternal(
    {
      locale: conditionStore.getLocale(),
      enableI18n: conditionStore.getEnableI18n(),
    },
    messages
  );
});

/** Return a registered-message translation function for the current request. */
export const getMessages = createServerOnlyFn(async () => {
  const conditionStore = getConditionStore();
  return getMessagesInternal({
    locale: conditionStore.getLocale(),
    enableI18n: conditionStore.getEnableI18n(),
  });
});

/** Return a dictionary translation function for the current server request. */
export const getTranslations = createServerOnlyFn(async (rootId?: string) => {
  const conditionStore = getConditionStore();
  return getTranslationsInternal({
    locale: conditionStore.getLocale(),
    enableI18n: conditionStore.getEnableI18n(),
    rootId,
  });
});
