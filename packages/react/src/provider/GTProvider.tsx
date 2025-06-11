import { useMemo } from 'react';
import { GTContext } from './GTContext';
import {
  defaultCacheUrl,
  defaultRuntimeApiUrl,
  libraryDefaultLocale,
} from 'generaltranslation/internal';
import useRuntimeTranslation from './hooks/useRuntimeTranslation';
import { defaultRenderSettings } from '../rendering/defaultRenderSettings';
import { readAuthFromEnv } from '../utils/utils';
import useCreateInternalUseGTFunction from './hooks/useCreateInternalUseGTFunction';
import useCreateInternalUseDictFunction from './hooks/useCreateInternalUseDictFunction';
import { isSSREnabled } from './helpers/isSSREnabled';
import { defaultLocaleCookieName } from '../utils/cookies';
import { GTProviderProps } from '../types/config';
import { useLocaleData } from './hooks/useLocaleData';
import { useErrorChecks } from './hooks/useErrorChecks';
import { GT } from 'generaltranslation';
import { useLoadDictionary } from './hooks/useLoadDictionary';
import { useLoadTranslations } from './hooks/useLoadTranslations';
/**
 * Provides General Translation context to its children, which can then access `useGT`, `useLocale`, and `useDefaultLocale`.
 *
 * @param {React.ReactNode} children - The children components that will use the translation context.
 * @param {string} [projectId] - The project ID required for General Translation cloud services.
 * @param {Dictionary} [dictionary=defaultDictionary] - The translation dictionary for the project.
 * @param {string[]} [locales] - The list of approved locales for the project.
 * @param {string} [defaultLocale=libraryDefaultLocale] - The default locale to use if no other locale is found.
 * @param {string} [locale] - The current locale, if already set.
 * @param {string} [cacheUrl='https://cdn.gtx.dev'] - The URL of the cache service for fetching translations.
 * @param {string} [runtimeUrl='https://runtime.gtx.dev'] - The URL of the runtime service for fetching translations.
 * @param {RenderSettings} [renderSettings=defaultRenderSettings] - The settings for rendering translations.
 * @param {string} [_versionId] - The version ID for fetching translations.
 * @param {string} [devApiKey] - The API key for development environments.
 * @param {object} [metadata] - Additional metadata to pass to the context.
 * @param {boolean} [ssr=isSSREnabled()] - Whether to enable server-side rendering.
 * @param {string} [localeCookieName=defaultLocaleCookieName] - The name of the cookie to store the locale.
 * @param {TranslationsObject | null} [translations=null] - The translations to use for the context.
 * @param {React.ReactNode} [fallback = undefined] - Custom fallback to display while loading
 *
 * @returns {JSX.Element} The provider component for General Translation context.
 */
export default function GTProvider({
  children,
  config,
  projectId: _projectId = config?.projectId || '',
  devApiKey: _devApiKey = config?.devApiKey || '',
  dictionary: _dictionary = config?.dictionary || {},
  locales = config?.locales || [],
  defaultLocale = config?.defaultLocale || libraryDefaultLocale,
  cacheUrl = config?.cacheUrl || defaultCacheUrl,
  runtimeUrl = config?.runtimeUrl || defaultRuntimeApiUrl,
  renderSettings = config?.renderSettings || defaultRenderSettings,
  ssr = config?.ssr || isSSREnabled(),
  localeCookieName = config?.localeCookieName || defaultLocaleCookieName,
  locale: _locale = '',
  loadDictionary,
  loadTranslations,
  fallback = undefined,
  translations: _translations = null,
  _versionId,
  customMapping = config?.customMapping,
  ...metadata
}: GTProviderProps) {
  // ---------- PROPS ---------- //

  // Read env to get projectId and API key
  const { projectId, devApiKey } = readAuthFromEnv(_projectId, _devApiKey);

  // Get locale data including
  // locale - the user's locale
  // setLocale - function to set the user's locale
  // locales - approved locales for the project
  // translationRequired - whether translation is required
  // dialectTranslationRequired - whether dialect translation (e.g. en-US -> en-GB) is required
  const {
    locale,
    setLocale,
    locales: approvedLocales,
    translationRequired,
    dialectTranslationRequired,
  } = useLocaleData({
    _locale,
    defaultLocale,
    locales,
    ssr,
    localeCookieName,
  });

  // Define the GT instance
  // Used for custom mapping and as a driver for the runtime translation
  const gt = useMemo(
    () =>
      new GT({
        devApiKey,
        sourceLocale: defaultLocale,
        projectId,
        baseUrl: runtimeUrl,
        customMapping,
      }),
    [devApiKey, defaultLocale, projectId, runtimeUrl, customMapping]
  );

  // Determine the type of translation loading
  // custom - custom loading function provided
  // default - using GT provided cache
  // disabled - no translation loading
  const loadTranslationsType =
    (loadTranslations && 'custom') ||
    (cacheUrl && projectId && 'default') ||
    'disabled';

  // ---------- LOAD DICTIONARY ---------- //

  const dictionary = useLoadDictionary({
    _dictionary,
    loadDictionary,
    locale,
    defaultLocale,
  });

  // ---------- ERROR AND WARNING CHECKS ---------- //

  useErrorChecks({
    devApiKey,
    projectId,
    runtimeUrl,
    loadTranslationsType,
    cacheUrl,
    locales,
  });

  // ---------- TRANSLATION STATE ---------- //

  const { translations, setTranslations } = useLoadTranslations({
    _translations,
    translationRequired,
    loadTranslationsType,
    loadTranslations,
    locale,
    cacheUrl,
    projectId,
    _versionId,
  });

  // ------- RUNTIME TRANSLATION ----- //

  const {
    registerContentForTranslation,
    registerJsxForTranslation,
    runtimeTranslationEnabled,
  } = useRuntimeTranslation({
    locale,
    versionId: _versionId,
    projectId,
    defaultLocale,
    devApiKey,
    runtimeUrl,
    renderSettings,
    setTranslations,
    ...metadata,
  });

  // ---------- USE GT ---------- //

  const _internalUseGTFunction = useCreateInternalUseGTFunction(
    translations,
    locale,
    defaultLocale,
    translationRequired,
    dialectTranslationRequired,
    runtimeTranslationEnabled,
    registerContentForTranslation,
    renderSettings
  );

  // ---------- USE DICT ---------- //

  const _internalUseDictFunction = useCreateInternalUseDictFunction(
    dictionary,
    translations,
    locale,
    defaultLocale,
    translationRequired,
    dialectTranslationRequired,
    runtimeTranslationEnabled,
    registerContentForTranslation,
    renderSettings
  );

  // ----- RETURN ----- //

  const display = !!((!translationRequired || translations) && locale);

  // hang until cache response, then render translations or loading state (when waiting on API response)
  return (
    <GTContext.Provider
      value={{
        gt,
        registerContentForTranslation,
        registerJsxForTranslation,
        _internalUseGTFunction,
        _internalUseDictFunction,
        runtimeTranslationEnabled,
        locale,
        locales: approvedLocales,
        setLocale,
        defaultLocale,
        translations,
        translationRequired,
        dialectTranslationRequired,
        projectId,
        renderSettings,
      }}
    >
      {display ? children : fallback}
    </GTContext.Provider>
  );
}
