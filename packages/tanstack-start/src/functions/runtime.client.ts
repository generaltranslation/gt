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

/** Return the locale associated with the current request or browser. */
export const getLocale = (): string => getReadonlyConditionStore().getLocale();

/** Return whether internationalization is enabled for the current runtime. */
export const getEnableI18n = (): boolean =>
  getReadonlyConditionStore().getEnableI18n();

/** Return a string translation function for the current runtime. */
export const getGT = (messages?: Message[]): Promise<GTFunctionType> =>
  getGTInternal({ locale: getLocale(), enableI18n: getEnableI18n() }, messages);

/** Return a registered-message translation function for the current runtime. */
export const getMessages = (): Promise<MFunctionType> =>
  getMessagesInternal({ locale: getLocale(), enableI18n: getEnableI18n() });

/** Return a dictionary translation function for the current runtime. */
export const getTranslations = (rootId?: string): Promise<TFunctionType> =>
  getTranslationsInternal({
    locale: getLocale(),
    enableI18n: getEnableI18n(),
    rootId,
  });
