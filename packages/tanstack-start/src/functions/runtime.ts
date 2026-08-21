import { createIsomorphicFn } from '@tanstack/react-start';
import { getReadonlyConditionStore } from '@generaltranslation/react-core/pure';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';
import {
  getGTInternal,
  getMessagesInternal,
  getRuntimeEnvironment,
  getTranslationsInternal,
} from 'gt-i18n/internal';
import type {
  GTFunctionType,
  MFunctionType,
  Message,
  TFunctionType,
} from 'gt-i18n/types';
import { getConditionStore } from '../condition-store/singleton';

type LocaleConditions = {
  locale: string;
  enableI18n: boolean;
};

/**
 * In development a failed translation load rejects inside the i18n cache,
 * which would turn the server-function request into an HTTP 500; warn once
 * and degrade the request to source content instead.
 */
async function resolveWithSourceFallback<T>(
  conditions: LocaleConditions,
  create: (conditions: LocaleConditions) => Promise<T>
): Promise<T> {
  try {
    return await create(conditions);
  } catch (error) {
    if (getRuntimeEnvironment() !== 'development') throw error;
    console.warn(
      createDiagnosticMessage({
        source: 'gt-tanstack-start',
        severity: 'Warning',
        whatHappened: `Could not load translations for locale "${conditions.locale}", so this request renders untranslated content`,
        why: 'the translation loader failed, usually because translations for this locale have not been generated yet',
        fix: 'Generate translations for this locale, or check your loadTranslations configuration.',
        details: formatDiagnosticErrorDetails(error),
      })
    );
    return create({ ...conditions, enableI18n: false });
  }
}

function getServerConditions(): LocaleConditions {
  const conditionStore = getConditionStore();
  return {
    locale: conditionStore.getLocale(),
    enableI18n: conditionStore.getEnableI18n(),
  };
}

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
    .server((messages?: Message[]) =>
      resolveWithSourceFallback(getServerConditions(), (conditions) =>
        getGTInternal(conditions, messages)
      )
    )
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
  .server(() =>
    resolveWithSourceFallback(getServerConditions(), (conditions) =>
      getMessagesInternal(conditions)
    )
  )
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
    .server((rootId?: string) =>
      resolveWithSourceFallback(getServerConditions(), (conditions) =>
        getTranslationsInternal({ ...conditions, rootId })
      )
    )
    .client((rootId?: string) => {
      const conditionStore = getReadonlyConditionStore();
      return getTranslationsInternal({
        locale: conditionStore.getLocale(),
        enableI18n: conditionStore.getEnableI18n(),
        rootId,
      });
    });
