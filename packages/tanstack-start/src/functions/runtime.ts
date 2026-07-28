import { createIsomorphicFn } from '@tanstack/react-start';
import { getReadonlyConditionStore } from '@generaltranslation/react-core/pure';
import {
  getGTInternal,
  getMessagesInternal,
  getTranslationsInternal,
} from 'gt-i18n/internal';
import type {
  GTFunctionType,
  MFunctionType,
  Message,
  TFunctionType,
} from 'gt-i18n/types';
import { getConditionStore } from '../condition-store/singleton';

/** Return the locale associated with the current request or browser. */
export const getLocale: () => string = createIsomorphicFn()
  .server((): string => getConditionStore().getLocale())
  .client((): string => getReadonlyConditionStore().getLocale());

/** Return whether internationalization is enabled for the current runtime. */
export const getEnableI18n: () => boolean = createIsomorphicFn()
  .server((): boolean => getConditionStore().getEnableI18n())
  .client((): boolean => getReadonlyConditionStore().getEnableI18n());

/** Return a string translation function for the current runtime. */
export const getGT: (messages?: Message[]) => Promise<GTFunctionType> =
  createIsomorphicFn()
    .server((messages?: Message[]) => {
      const conditionStore = getConditionStore();
      return getGTInternal(
        {
          locale: conditionStore.getLocale(),
          enableI18n: conditionStore.getEnableI18n(),
        },
        messages
      );
    })
    .client((messages?: Message[]) => {
      const conditionStore = getReadonlyConditionStore();
      return getGTInternal(
        {
          locale: conditionStore.getLocale(),
          enableI18n: conditionStore.getEnableI18n(),
        },
        messages
      );
    });

/** Return a registered-message translation function for the current runtime. */
export const getMessages: () => Promise<MFunctionType> = createIsomorphicFn()
  .server(() => {
    const conditionStore = getConditionStore();
    return getMessagesInternal({
      locale: conditionStore.getLocale(),
      enableI18n: conditionStore.getEnableI18n(),
    });
  })
  .client(() => {
    const conditionStore = getReadonlyConditionStore();
    return getMessagesInternal({
      locale: conditionStore.getLocale(),
      enableI18n: conditionStore.getEnableI18n(),
    });
  });

/** Return a dictionary translation function for the current runtime. */
export const getTranslations: (rootId?: string) => Promise<TFunctionType> =
  createIsomorphicFn()
    .server((rootId?: string) => {
      const conditionStore = getConditionStore();
      return getTranslationsInternal({
        locale: conditionStore.getLocale(),
        enableI18n: conditionStore.getEnableI18n(),
        rootId,
      });
    })
    .client((rootId?: string) => {
      const conditionStore = getReadonlyConditionStore();
      return getTranslationsInternal({
        locale: conditionStore.getLocale(),
        enableI18n: conditionStore.getEnableI18n(),
        rootId,
      });
    });
