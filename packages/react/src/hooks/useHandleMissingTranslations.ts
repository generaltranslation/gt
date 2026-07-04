'server-only';

import {
  OnMissingDictionaryEntry,
  OnMissingDictionaryObj,
  OnMissingTranslation,
} from '@generaltranslation/react-core/pure';
import { I18nStore } from '@generaltranslation/react-core/components';
import { useMemo } from 'react';

/**
 * Returns handle missing translation callback for server runtime
 * These DO get invoked during server render which is not pure, but this
 * is acceptable for dev hot reload because we MUST trigger a translate
 * call on the server to persist translations
 */
export function useHandleMissingTranslations(i18nStore: I18nStore): {
  onMissingTranslation: OnMissingTranslation;
  onMissingDictionaryEntry: OnMissingDictionaryEntry;
  onMissingDictionaryObj: OnMissingDictionaryObj;
} {
  return useMemo(
    () => ({
      onMissingTranslation: (lookup) => i18nStore.translate(lookup),
      onMissingDictionaryEntry: (lookup) =>
        i18nStore.translateDictionaryEntry(lookup),
      onMissingDictionaryObj: (lookup) =>
        i18nStore.translateDictionaryObject(lookup),
    }),
    [i18nStore]
  );
}
