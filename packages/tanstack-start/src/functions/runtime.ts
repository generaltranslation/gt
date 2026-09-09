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
import { getRequestConditions } from './requestConditions';

const getTranslationConditions = createIsomorphicFn()
  .server(getRequestConditions)
  .client(() => {
    const conditionStore = getReadonlyConditionStore();
    return {
      locale: conditionStore.getLocale(),
      enableI18n: conditionStore.getEnableI18n(),
    };
  });

/** Return the locale associated with the current request or browser. */
export function getLocale(): string {
  return getTranslationConditions().locale;
}

/** Return whether internationalization is enabled for the current runtime. */
export function getEnableI18n(): boolean {
  return getTranslationConditions().enableI18n;
}

/** Return a string translation function for the current runtime. */
export function getGT(messages?: Message[]): Promise<GTFunctionType> {
  return getGTInternal(getTranslationConditions(), messages);
}

/** Return a registered-message translation function for the current runtime. */
export function getMessages(): Promise<MFunctionType> {
  return getMessagesInternal(getTranslationConditions());
}

/** Return a dictionary translation function for the current runtime. */
export function getTranslations(rootId?: string): Promise<TFunctionType> {
  return getTranslationsInternal({
    ...getTranslationConditions(),
    rootId,
  });
}
