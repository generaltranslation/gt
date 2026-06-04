'server-only';

import {
  type Message,
  type OnMissingTranslation,
  type OnMissingDictionaryEntry,
  type OnMissingDictionaryObj,
  useI18nStore,
  useGT as useCoreGT,
  useMessages as useCoreMessages,
  useTranslations as useCoreTranslations,
} from '@generaltranslation/react-core/context';
import { useCallback } from 'react';

/**
 * Typically i18nStore.translate() is called after commit (via useEffect),
 * but for server runtimes, this is not possible. We have to call it
 * during the render phase. Of course this is only called for hot reload
 * so this is an acceptable violation of purity.
 */

export function useGT(_messages?: Message[]) {
  const onMissingTranslation = useOnMissingTranslation();
  return useCoreGT(_messages, onMissingTranslation);
}

export function useMessages(_messages?: Message[]) {
  const onMissingTranslation = useOnMissingTranslation();
  return useCoreMessages(_messages, onMissingTranslation);
}

export function useTranslations(rootId?: string) {
  const onMissingTranslation = useOnMissingTranslation();
  const onMissingDictionaryEntry = useOnMissingDictionaryEntry();
  const onMissingDictionaryObject = useOnMissingDictionaryObject();
  return useCoreTranslations(rootId, {
    onMissingTranslation,
    onMissingDictionaryEntry,
    onMissingDictionaryObject,
  });
}

// ----- Helpers ----- //

function useOnMissingTranslation(): OnMissingTranslation {
  const i18nStore = useI18nStore();
  return useCallback(
    (lookup) => {
      i18nStore.translate(lookup);
    },
    [i18nStore]
  );
}

function useOnMissingDictionaryEntry(): OnMissingDictionaryEntry {
  const i18nStore = useI18nStore();
  return useCallback(
    (lookup) => {
      i18nStore.translateDictionaryEntry(lookup);
    },
    [i18nStore]
  );
}

function useOnMissingDictionaryObject(): OnMissingDictionaryObj {
  const i18nStore = useI18nStore();
  return useCallback(
    (lookup) => {
      i18nStore.translateDictionaryObject(lookup);
    },
    [i18nStore]
  );
}
