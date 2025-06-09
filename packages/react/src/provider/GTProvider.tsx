import React, { useMemo, useEffect, useState } from 'react';
import GT, {
  isSameLanguage,
  requiresTranslation,
} from 'generaltranslation';
import { GTContext } from './GTContext';
import {
  Dictionary,
  TranslationsObject,
} from '../types/types';
import {
  defaultCacheUrl,
  defaultRuntimeApiUrl,
  libraryDefaultLocale,
} from 'generaltranslation/internal';
import {
  apiKeyInProductionError,
  APIKeyMissingWarn,
  createUnsupportedLocalesWarning,
  customLoadTranslationsError,
  projectIdMissingWarning,
} from '../errors/createErrors';
import { getSupportedLocale } from '@generaltranslation/supported-locales';
import useRuntimeTranslation from './hooks/useRuntimeTranslation';
import { defaultRenderSettings } from '../rendering/defaultRenderSettings';
import { readAuthFromEnv } from '../utils/utils';
import fetchTranslations from '../utils/fetchTranslations';
import useCreateInternalUseGTFunction from './hooks/useCreateInternalUseGTFunction';
import useCreateInternalUseDictFunction from './hooks/useCreateInternalUseDictFunction';
import { isSSREnabled } from './helpers/isSSREnabled';
import { defaultLocaleCookieName } from '../utils/cookies';
import loadDictionaryHelper from '../dictionaries/loadDictionaryHelper';
import mergeDictionaries from '../dictionaries/mergeDictionaries';
import { GTProviderProps } from '../types/config';
import { useLocaleData } from './hooks/useLocaleData';
import { useErrorChecks } from './hooks/useErrorChecks';

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
  ...metadata
}: GTProviderProps) {

  // ---------- PROPS ---------- //

  // Read env
  const { projectId, devApiKey } = readAuthFromEnv(_projectId, _devApiKey);

  const { 
    locale, setLocale, locales: approvedLocales,
    translationRequired, dialectTranslationRequired 
  } =
    useLocaleData({
      _locale,
      defaultLocale,
      locales,
      ssr,
      localeCookieName,
  });

  const gt = useMemo(() => new GT({
    devApiKey, 
    sourceLocale: defaultLocale,
    projectId,
    baseUrl: runtimeUrl
  }), [devApiKey, defaultLocale, projectId, runtimeUrl]);

  const loadTranslationsType = (
    (loadTranslations && 'custom') ||
    (cacheUrl && projectId && 'default') ||
    'disabled'
  );

  // ---------- SET UP DICTIONARY ---------- //

  const [dictionary, setDictionary] = useState<Dictionary | undefined>(
    _dictionary
  );

  // Resolve dictionary when not provided, but using custom dictionary loader
  useEffect(() => {
    // Early return if dictionary is provided or not loading translation dictionary
    if (!loadDictionary) return;

    let storeResults = true;

    (async () => {
      // Load dictionary for default locale
      const defaultLocaleDictionary =
        (await loadDictionaryHelper(defaultLocale, loadDictionary)) || {};

      // Load dictionary for locale
      const localeDictionary =
        (await loadDictionaryHelper(locale, loadDictionary)) || {};

      // Merge dictionaries
      const mergedDictionary = mergeDictionaries(
        defaultLocaleDictionary,
        localeDictionary
      );

      // Update dictionary
      if (storeResults) {
        setDictionary(mergedDictionary || {});
      }
    })();

    // cancel load if a dep changes
    return () => {
      storeResults = false;
    };
  }, [loadDictionary, locale, defaultLocale]);

  // ---------- ERROR AND WARNING CHECKS ---------- //

  useErrorChecks({
    devApiKey,
    projectId,
    runtimeUrl,
    loadTranslationsType,
    cacheUrl,
    locales
  });

  // ---------- TRANSLATION STATE ---------- //

  /** Key for translation tracking:
   * Cache Loading            -> translations = null
   * Cache Fail (for locale)  -> translations = {}
   * Cache Fail (for hash)    -> translations[hash] = undefined
   *
   * API Loading              -> translations[hash] = TranslationLoading
   * API Fail (for batch)     -> translations[hash] = TranslationError
   * API Fail (for hash)      -> translations[hash] = TranslationError
   *
   * Success (Cache/API)      -> translations[hash] = TranslationSuccess
   *
   * Possible scenarios:
   * Cache Loading -> Success
   * Cache Loading -> Cache Fail -> API Loading -> Success
   * Cache Loading -> Cache Fail -> API Loading -> API Fail
   */

  const [translations, setTranslations] = useState<TranslationsObject | null>(
    _translations ||
      (translationRequired && loadTranslationsType !== 'disabled')
      ? null
      : {}
  );

  // Reset translations if locale changes (null to trigger a new cache fetch)
  useEffect(
    () =>
      setTranslations(
        translationRequired && loadTranslationsType !== 'disabled' ? null : {}
      ),
    [locale, loadTranslationsType]
  );

  // ------- RUNTIME TRANSLATION ----- //
  // TODO: do this in a plugin

  const { 
    registerContentForTranslation, 
    registerJsxForTranslation, 
    runtimeTranslationEnabled 
  } =
    useRuntimeTranslation({
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

  // ---------- ATTEMPT TO LOAD TRANSLATIONS ---------- //

  useEffect(() => {
    // Early return if no need to translate
    if (
      translations ||
      !translationRequired ||
      loadTranslationsType === 'disabled'
    )
      return;

    // Fetch translations
    let storeResults = true;
    (async () => {
      let result;
      switch (loadTranslationsType) {
        case 'custom':
          // check is redundant, but makes ts happy
          if (loadTranslations) {
            try {
              result = await loadTranslations(locale);
            } catch (error) {
              console.error(customLoadTranslationsError(locale), error);
            }
          }
          break;
        case 'default':
          try {
            result = await fetchTranslations({
              cacheUrl,
              projectId,
              locale,
              versionId: _versionId,
            });
          } catch (error) {
            console.error(error);
          }
          break;
      }

      // fallback to empty object if failed or disabled
      if (!result) {
        result = {};
      }

      // Parse
      try {
        result = Object.entries(result).reduce(
          (
            translationsAcc: Record<string, any>,
            [hash, target]: [string, any]
          ) => {
            translationsAcc[hash] = { state: 'success', target };
            return translationsAcc;
          },
          {}
        );
      } catch (error) {
        console.error(error);
      }

      // Record results
      if (storeResults) {
        setTranslations(result); // not classified as a translation error, because we can still fetch from API
      }
    })();

    // Cancel fetch if a dep changes
    return () => {
      storeResults = false;
    };
  }, [
    translations,
    translationRequired,
    loadTranslationsType,
    cacheUrl,
    projectId,
    locale,
    _versionId,
  ]);

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
