'server-only';

import {
  OnMissingTranslation,
  I18nStore,
} from '@generaltranslation/react-core/pure';
import { useMemo } from 'react';

/**
 * Returns handle missing translation callback for server runtime
 * These DO get invoked during server render which is not pure, but this
 * is acceptable for dev hot reload because we MUST trigger a translate
 * call on the server to persist translations
 */
export function useHandleMissingTranslations(i18nStore: I18nStore): {
  onMissingTranslation: OnMissingTranslation;
} {
  return useMemo(
    () => ({
      onMissingTranslation: (lookup) => i18nStore.translate(lookup),
    }),
    [i18nStore]
  );
}
