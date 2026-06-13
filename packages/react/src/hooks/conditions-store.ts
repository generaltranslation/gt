import { useCallback } from 'react';
import { useConditionStore } from '@generaltranslation/react-core/hooks';
import { setCookieValue } from '../condition-store/cookies';

/**
 * Returns a function that sets the locale
 */
export function useSetLocale() {
  const conditionStore = useConditionStore();
  return useCallback(
    (locale: string) => {
      if (typeof window !== 'undefined') {
        // set cookie
        const cookieName = 'generaltranslation.locale';
        setCookieValue({
          cookieName,
          value: locale,
        });
      }
      conditionStore.setLocale(locale);
      window.location.reload();
    },
    [conditionStore]
  );
}

/**
 * Returns a function that sets the enableI18n flag in the condition store.
 */
export function useSetEnableI18n() {
  const conditionStore = useConditionStore();
  return useCallback(
    (enableI18n: boolean) => {
      if (typeof window !== 'undefined') {
        // set cookie
        const cookieName = 'generaltranslation.enableI18n';
        setCookieValue({
          cookieName,
          value: enableI18n ? 'true' : 'false',
        });
      }
      conditionStore.setEnableI18n(enableI18n);
      window.location.reload();
    },
    [conditionStore]
  );
}
