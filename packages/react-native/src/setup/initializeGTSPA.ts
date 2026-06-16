import {
  getReadonlyConditionStoreWithFallback,
  getTranslationsSnapshot,
  internalInitializeGTSPA,
} from '@generaltranslation/react-core/context';
import {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
} from '@generaltranslation/react-core/internal';
import { getNativeLocales } from '../utils/getNativeLocales';
import { nativeStoreGet } from '../utils/nativeStore';

type LocaleCandidates = string | string[] | undefined;

type InternalInitializeGTSPAParams = Parameters<
  typeof internalInitializeGTSPA
>[0];

type ReloadState = {
  locale: string;
  enableI18n: boolean;
};

type ReloadRuntime = (state: ReloadState) => void | Promise<void>;

export type InitializeGTSPAParams = Omit<
  InternalInitializeGTSPAParams,
  'locale'
> & {
  locale?: LocaleCandidates;
  localeCookieName?: string;
  enableI18nCookieName?: string;
  reload?: ReloadRuntime;
};

let activeLocaleStoreName = defaultLocaleCookieName;
let activeEnableI18nStoreName = defaultEnableI18nCookieName;
let activeReloadRuntime: ReloadRuntime = () => {};

/**
 * Initialize GT for a React Native single-page app.
 */
export async function initializeGTSPA(config: InitializeGTSPAParams) {
  activeLocaleStoreName = config.localeCookieName ?? defaultLocaleCookieName;
  activeEnableI18nStoreName =
    config.enableI18nCookieName ?? defaultEnableI18nCookieName;
  activeReloadRuntime = config.reload ?? (() => {});

  internalInitializeGTSPA({
    ...config,
    locale: getInitialLocale(config),
    enableI18n: getInitialEnableI18n(config),
  });

  await getTranslationsSnapshot(
    getReadonlyConditionStoreWithFallback().getLocale()
  );
}

export function getLocaleStoreName() {
  return activeLocaleStoreName;
}

export function getEnableI18nStoreName() {
  return activeEnableI18nStoreName;
}

export function getReloadRuntime() {
  return activeReloadRuntime;
}

function getInitialLocale({
  locale,
  localeCookieName = defaultLocaleCookieName,
}: Pick<InitializeGTSPAParams, 'locale' | 'localeCookieName'>) {
  const candidates: string[] = [];
  pushLocaleCandidates(candidates, locale);
  pushLocaleCandidates(candidates, nativeStoreGet(localeCookieName));
  candidates.push(...getNativeLocales());
  return candidates;
}

function pushLocaleCandidates(
  target: string[],
  locale: LocaleCandidates | null
) {
  if (!locale) return;
  if (Array.isArray(locale)) {
    target.push(...locale);
    return;
  }
  target.push(locale);
}

function getInitialEnableI18n({
  enableI18n,
  enableI18nCookieName = defaultEnableI18nCookieName,
}: Pick<InitializeGTSPAParams, 'enableI18n' | 'enableI18nCookieName'>) {
  const storedEnableI18n = nativeStoreGet(enableI18nCookieName);
  if (storedEnableI18n === null) return enableI18n;
  return storedEnableI18n === 'true';
}
