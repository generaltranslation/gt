import { Suspense, useMemo } from 'react';
import { GTContext } from './GTContext';
import {
  defaultCacheUrl,
  defaultRuntimeApiUrl,
  libraryDefaultLocale,
} from 'generaltranslation/internal';
import useRuntimeTranslation from './hooks/useRuntimeTranslation';
import { defaultRenderSettings } from '../rendering/defaultRenderSettings';
import useCreateInternalUseGTFunction from './hooks/translation/useCreateInternalUseGTFunction';
import useCreateInternalUseTranslationsFunction from './hooks/translation/useCreateInternalUseTranslationsFunction';
import {
  defaultLocaleCookieName,
  defaultRegionCookieName,
} from '../utils/cookies';
import { GTProviderProps } from '../types-dir/config';
import { useLocaleState } from './hooks/locales/useLocaleState';
import { useErrorChecks } from './hooks/useErrorChecks';
import { GT, resolveAliasLocale } from 'generaltranslation';
import { useLoadDictionary } from './hooks/useLoadDictionary';
import { useLoadTranslations } from './hooks/useLoadTranslations';
import { useCreateInternalUseTranslationsObjFunction } from './hooks/translation/useCreateInternalUseTranslationsObjFunction';

// Special overriden function types
import { AuthFromEnvParams, AuthFromEnvReturn } from '../utils/types';
import {
  UseDetermineLocaleParams,
  UseDetermineLocaleReturn,
} from './hooks/locales/types';
import { UseRegionStateParams, UseRegionStateReturn } from './hooks/types';

// Deprecated functions, will be removed in a future version
import { readAuthFromEnv as _readAuthFromEnv } from '../utils/utils';
import { isSSREnabled } from './helpers/isSSREnabled';
import { useDetermineLocale as _useDetermineLocale } from './hooks/locales/useDetermineLocale';
import { useRegionState as _useRegionState } from './hooks/useRegionState';
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
 * @param {Translations | null} [translations=null] - The translations to use for the context.
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
  region: _region,
  loadDictionary,
  loadTranslations,
  fallback = undefined,
  translations: _translations = null,
  _versionId,
  customMapping = config?.customMapping,
  readAuthFromEnv = _readAuthFromEnv,
  useDetermineLocale = _useDetermineLocale,
  useRegionState = _useRegionState,
  ...metadata
}: GTProviderProps & {
  readAuthFromEnv: (params: AuthFromEnvParams) => AuthFromEnvReturn;
  useDetermineLocale: (
    params: UseDetermineLocaleParams
  ) => UseDetermineLocaleReturn;
  useRegionState: (params: UseRegionStateParams) => UseRegionStateReturn;
}) {
  // ---------- PROPS ---------- //
  if (_locale) {
    _locale = resolveAliasLocale(_locale, customMapping);
  }

  // Read env to get projectId and API key
  const { projectId, devApiKey } = readAuthFromEnv({
    projectId: _projectId,
    devApiKey: _devApiKey,
  });

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
  } = useLocaleState({
    _locale,
    defaultLocale,
    locales,
    ssr,
    localeCookieName,
    customMapping,
    useDetermineLocale,
  });

  // Define the region instance
  const { region, setRegion } = useRegionState({
    _region,
    ssr,
    regionCookieName: defaultRegionCookieName,
  });

  // Define the GT instance
  // Used for custom mapping and as a driver for the runtime translation
  const gt = useMemo(
    () =>
      new GT({
        devApiKey,
        sourceLocale: defaultLocale,
        targetLocale: locale,
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

  const {
    dictionary,
    setDictionary,
    dictionaryTranslations,
    setDictionaryTranslations,
  } = useLoadDictionary({
    _dictionary,
    _dictionaryTranslations: {},
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
    gt,
  });

  // ------- RUNTIME TRANSLATION ----- //

  const {
    registerIcuForTranslation,
    registerJsxForTranslation,
    developmentApiEnabled,
  } = useRuntimeTranslation({
    gt,
    locale,
    versionId: _versionId,
    defaultLocale,
    runtimeUrl,
    renderSettings,
    setTranslations,
    ...metadata,
  });

  // ---------- USE GT ---------- //

  const {
    _tFunction,
    _mFunction,
    _filterMessagesForPreload,
    _preloadMessages,
  } = useCreateInternalUseGTFunction({
    gt,
    translations,
    locale,
    defaultLocale,
    translationRequired,
    developmentApiEnabled,
    registerIcuForTranslation,
  });

  // ---------- USE DICT ---------- //

  const _dictionaryFunction = useCreateInternalUseTranslationsFunction(
    dictionary,
    dictionaryTranslations,
    translations,
    locale,
    defaultLocale,
    translationRequired,
    dialectTranslationRequired,
    developmentApiEnabled,
    registerIcuForTranslation
  );

  const _dictionaryObjFunction = useCreateInternalUseTranslationsObjFunction(
    dictionary || {},
    dictionaryTranslations || {},
    setDictionary,
    setDictionaryTranslations,
    translations,
    locale,
    defaultLocale,
    translationRequired,
    dialectTranslationRequired,
    developmentApiEnabled,
    registerIcuForTranslation,
    _dictionaryFunction
  );

  // ----- RETURN ----- //

  const display = !!((!translationRequired || translations) && locale);

  // hang until cache response, then render translations or loading state (when waiting on API response)
  return (
    <GTContext.Provider
      value={{
        gt,
        registerIcuForTranslation,
        registerJsxForTranslation,
        _tFunction,
        _mFunction,
        _filterMessagesForPreload,
        _preloadMessages,
        _dictionaryFunction,
        _dictionaryObjFunction,
        developmentApiEnabled,
        locale,
        locales: approvedLocales,
        setLocale,
        defaultLocale,
        region,
        setRegion,
        translations,
        translationRequired,
        dialectTranslationRequired,
        projectId,
        renderSettings,
      }}
    >
      <Suspense fallback={fallback}>{display ? children : fallback}</Suspense>
    </GTContext.Provider>
  );
}
