import { ref } from 'vue';
import {
  createConditionStoreSingleton,
  getI18nCache,
  getI18nConfig,
} from 'gt-i18n/internal';
import type {
  LocaleCandidates,
  WritableConditionStoreInterface,
} from 'gt-i18n/internal/types';

/**
 * Cookie used to persist the user's locale across visits.
 * Shared with the other GT libraries.
 */
export const defaultLocaleCookieName = 'generaltranslation.locale';

export type ConditionStoreOptions = {
  locale?: LocaleCandidates;
  region?: string;
  enableI18n?: boolean;
  localeCookieName?: string;
  /** Keep `<html lang>` / `<html dir>` in sync with the locale. Default true. */
  syncHtmlAttrs?: boolean;
};

/**
 * gt-vue installs its condition store into the shared gt-i18n singleton slot,
 * so gt-i18n's `t()` and `getLocale()` read the same state as the composables.
 */
export const {
  getConditionStore,
  setConditionStore,
  isConditionStoreInitialized,
} = createConditionStoreSingleton<WritableConditionStoreInterface>(
  'gt-vue is not initialized. Create the plugin with createGT() before rendering.'
);

/**
 * Creates the reactive condition store: locale, region, and enableI18n are
 * backed by Vue refs, so every `<T>`, translation function, and formatter
 * that reads them re-renders when they change.
 *
 * `setLocale` loads the new locale's translations first and then flips the
 * ref, so the whole app switches languages reactively — no page reload.
 */
export function createConditionStore(
  options: ConditionStoreOptions
): WritableConditionStoreInterface {
  const config = getI18nConfig();
  const localeCookieName = options.localeCookieName ?? defaultLocaleCookieName;
  const syncHtml = options.syncHtmlAttrs ?? true;

  // Priority: cookie (persisted user selection) > explicit option > navigator
  const candidates = [
    ...toArray(readCookie(localeCookieName)),
    ...toArray(options.locale),
    ...(typeof navigator !== 'undefined' ? navigator.languages || [] : []),
  ];
  const locale = ref(config.resolveSupportedLocale(candidates));
  const region = ref(options.region);
  const enableI18n = ref(options.enableI18n ?? true);

  writeCookie(localeCookieName, locale.value);
  const syncHtmlAttrs = (): void => {
    if (!syncHtml || typeof document === 'undefined') return;
    document.documentElement.setAttribute('lang', locale.value);
    document.documentElement.setAttribute(
      'dir',
      config.getGTClass().getLocaleDirection(locale.value)
    );
  };
  syncHtmlAttrs();

  let pendingLocale: string | undefined;
  const setLocale = (candidate: LocaleCandidates): void => {
    const resolved = config.resolveSupportedLocale(candidate);
    if (resolved === locale.value) return;
    writeCookie(localeCookieName, resolved);
    pendingLocale = resolved;
    // Load translations for the new locale, then flip the ref so the app
    // re-renders with everything synchronously available.
    void Promise.all([
      getI18nCache().loadTranslations(resolved),
      getI18nCache().loadDictionary(resolved),
    ])
      .catch(() => undefined)
      .then(() => {
        if (pendingLocale !== resolved) return; // superseded by a newer call
        locale.value = resolved;
        syncHtmlAttrs();
      });
  };

  return {
    getLocale: () => locale.value,
    setLocale,
    getRegion: () => region.value,
    setRegion: (value) => {
      region.value = value;
    },
    getEnableI18n: () => enableI18n.value,
    setEnableI18n: (value) => {
      enableI18n.value = value;
    },
  };
}

function toArray(value: LocaleCandidates | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function readCookie(cookieName: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${cookieName}=`))
    ?.split('=')[1];
}

function writeCookie(cookieName: string, value: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${cookieName}=${value};path=/`;
}
