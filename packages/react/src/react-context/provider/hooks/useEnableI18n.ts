import { useEffect, useState, useRef } from 'react';
import type {
  UseEnableI18nParams,
  UseEnableI18nReturn,
} from '@generaltranslation/react-core/types';
import { getCookieValue, setCookieValue } from '../../../shared/cookies';

/**
 * Sync: no cookie
 * Async: listen to cookie, until promise resolves
 *
 * Unfortunately, when dealing with SSR and an async enableI18n flag, there is no way to avoid a flicker of the default locale
 * @returns enableI18n flag
 */
export function useEnableI18n({
  enableI18n: _enableI18n,
  enableI18nCookieName,
  enableI18nLoaded,
  ssr,
}: UseEnableI18nParams): UseEnableI18nReturn {
  // undefined means loading synchronously, otherwise loading asynchronously
  const asyncEnabled = enableI18nLoaded !== undefined;

  // Track if this is the first render for SSR hydration recovery
  const isFirstRender = useRef(true);

  const getCookieEnableI18nValue = () => {
    const rawCookieValue = getCookieValue(enableI18nCookieName);
    return rawCookieValue === 'true'
      ? true
      : rawCookieValue === 'false'
        ? false
        : null;
  };

  // Extract state from cookie or default _enableI18n flag
  const [enableI18n, setEnableI18n] = useState(() =>
    !asyncEnabled || ssr
      ? _enableI18n
      : (getCookieEnableI18nValue() ?? _enableI18n)
  );

  // SSR hydration recovery: check cookie after first render
  useEffect(() => {
    if (ssr && asyncEnabled && isFirstRender.current) {
      isFirstRender.current = false;
      const cookieValue = getCookieEnableI18nValue();
      if (cookieValue !== null && cookieValue !== enableI18n) {
        setEnableI18n(cookieValue);
      }
      return;
    }
    isFirstRender.current = false;
  }, [ssr, asyncEnabled, enableI18nCookieName, enableI18n]);

  // Update state on param changes
  useEffect(() => {
    // no change, return
    if (enableI18n === _enableI18n) {
      return;
    }

    // if no async loaded, use _enableI18n flag
    if (!asyncEnabled) {
      setEnableI18n(_enableI18n);
      return;
    }

    // if still waiting on async, don't respond to changes
    if (!enableI18nLoaded) {
      return;
    }

    // sync loaded, so listen to the _enableI18n flag
    setCookieValue(enableI18nCookieName, _enableI18n ? 'true' : 'false');
    // update state
    setEnableI18n(_enableI18n);
  }, [
    _enableI18n,
    enableI18n,
    asyncEnabled,
    enableI18nLoaded,
    enableI18nCookieName,
  ]);

  // return established flag
  return { enableI18n };
}
