import { useEffect, useState, useRef } from 'react';
import type {
  UseEnableI18nParams,
  UseEnableI18nReturn,
} from '@generaltranslation/react-core/types';
import { nativeStoreGet, nativeStoreSet } from '../../utils/nativeStore';

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

  // Extract state from cookie or default _enableI18n flag
  const [enableI18n, setEnableI18n] = useState(
    getInitialEnableI18n({
      _enableI18n,
      asyncEnabled,
      enableI18nCookieName,
      ssr,
    })
  );

  // SSR hydration recovery: check cookie after first render
  useEffect(() => {
    if (ssr && asyncEnabled && isFirstRender.current) {
      isFirstRender.current = false;
      const cookieValue = getCookieEnableI18nValue(enableI18nCookieName);
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
    persistEnableI18nFlagToCookie({
      enableI18n: _enableI18n,
      enableI18nCookieName,
    });
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

/**
 * Get initial enableI18n flag
 */
function getInitialEnableI18n({
  _enableI18n,
  asyncEnabled,
  enableI18nCookieName,
  ssr,
}: {
  _enableI18n: boolean;
  asyncEnabled: boolean;
  enableI18nCookieName: string;
  ssr: boolean;
}): boolean {
  // Sync behavior: return _enableI18n flag
  if (!asyncEnabled) {
    return _enableI18n;
  }
  // Unfortunately, for SSR, we have to sacrifice the first render cycle to avoid hydration errors
  if (ssr) {
    return _enableI18n;
  }
  // Async behavior: listen to cookie
  const cookieValue = getCookieEnableI18nValue(enableI18nCookieName);
  if (cookieValue !== null) {
    return cookieValue;
  }
  // Fallback to default value
  return _enableI18n;
}

function getCookieEnableI18nValue(
  enableI18nCookieName: string
): boolean | null {
  const rawCookieValue = nativeStoreGet(enableI18nCookieName);
  return rawCookieValue === 'true'
    ? true
    : rawCookieValue === 'false'
      ? false
      : null;
}

function persistEnableI18nFlagToCookie({
  enableI18n,
  enableI18nCookieName,
}: {
  enableI18n: boolean;
  enableI18nCookieName: string;
}): void {
  nativeStoreSet(enableI18nCookieName, enableI18n ? 'true' : 'false');
}
