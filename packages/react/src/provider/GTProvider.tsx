import React, { useMemo, useEffect, useState } from 'react';
import {
  getLocaleProperties,
  isSameLanguage,
  requiresTranslation,
} from 'generaltranslation';
import { GTContext } from './GTContext';
import {
  CustomLoader,
  Dictionary,
  DictionaryObject,
  RenderMethod,
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
  customLoadDictionaryWarning,
  customLoadTranslationsError,
  devApiKeyProductionError,
  dictionaryMissingWarning,
  projectIdMissingWarning,
} from '../errors/createErrors';
import { getSupportedLocale } from '@generaltranslation/supported-locales';
import useRuntimeTranslation from '../hooks/internal/useRuntimeTranslation';
import { defaultRenderSettings } from './rendering/defaultRenderSettings';
import { useDetermineLocale } from '../hooks/internal/useDetermineLocale';
import { readAuthFromEnv } from '../utils/utils';
import fetchTranslations from '../utils/fetchTranslations';
import useCreateInternalUseGTFunction from '../hooks/internal/useCreateInternalUseGTFunction';
import useCreateInternalUseDictFunction from '../hooks/internal/useCreateInternalUseDictFunction';
import { isSSREnabled } from './helpers/isSSREnabled';
import { defaultLocaleCookieName } from '../utils/cookies';
import loadDictionaryHelper from './helpers/loadDictionaryHelper';
import mergeDictionaries from './helpers/mergeDictionaries';

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
  projectId: _projectId = '',
  devApiKey: _devApiKey,
  dictionary: _dictionary,
  locales = [],
  defaultLocale = libraryDefaultLocale,
  locale: _locale,
  cacheUrl = defaultCacheUrl,
  runtimeUrl = defaultRuntimeApiUrl,
  renderSettings = defaultRenderSettings,
  loadDictionary,
  loadTranslations,
  fallback = undefined,
  ssr = isSSREnabled(),
  localeCookieName = defaultLocaleCookieName,
  translations: _translations = null,
  _versionId,
  ...metadata
}: {
  children?: React.ReactNode;
  projectId?: string;
  devApiKey?: string;
  dictionary?: any;
  locales?: string[];
  defaultLocale?: string;
  locale?: string;
  cacheUrl?: string;
  runtimeUrl?: string;
  renderSettings?: {
    method: RenderMethod;
    timeout?: number;
  };
  translations?: TranslationsObject | null;
  loadDictionary?: CustomLoader;
  loadTranslations?: CustomLoader;
  _versionId?: string;
  ssr?: boolean;
  localeCookieName?: string;
  [key: string]: any;
}): React.JSX.Element {
  // ---------- SANITIZATION ---------- //

  // Read env
  const { projectId, devApiKey } = readAuthFromEnv(_projectId, _devApiKey);

  // Locale standardization
  locales = useMemo(() => {
    return Array.from(new Set([defaultLocale, ...locales]));
  }, [defaultLocale, locales]);

  // Get locale
  const [locale, setLocale] = useDetermineLocale({
    defaultLocale,
    locales,
    locale: _locale,
    ssr,
    localeCookieName,
  });

  // Translation at runtime during development is enabled
  const runtimeTranslationEnabled = useMemo(
    () =>
      !!(
        projectId &&
        runtimeUrl &&
        devApiKey &&
        process.env.NODE_ENV === 'development'
      ),
    [projectId, runtimeUrl, devApiKey]
  );

  // Loaders
  const loadTranslationsType = useMemo(
    () =>
      (loadTranslations && 'custom') ||
      (cacheUrl && projectId && 'default') ||
      'disabled',
    [loadTranslations]
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

  // ---------- MEMOIZED CHECKS ---------- //

  useMemo(() => {
    // Check: no devApiKey in production
    if (process.env.NODE_ENV === 'production' && devApiKey) {
      // When SSR is disabled, throw an error
      if (!ssr) throw new Error(apiKeyInProductionError);
      // When SSR is enabled, only error when detecting a dev api key
      if (devApiKey.startsWith('gtx-dev-'))
        throw new Error(devApiKeyProductionError);
    }

    // Check: projectId missing while using cache/runtime in dev
    if (
      loadTranslationsType !== 'custom' &&
      (cacheUrl || runtimeUrl) &&
      !projectId &&
      process.env.NODE_ENV === 'development'
    ) {
      console.warn(projectIdMissingWarning);
    }

    // Check: An API key is required for runtime translation
    if (
      projectId && // must have projectId for this check to matter anyways
      runtimeUrl &&
      loadTranslationsType !== 'custom' && // this usually conincides with not using runtime tx
      !devApiKey &&
      process.env.NODE_ENV === 'development'
    ) {
      console.warn(APIKeyMissingWarn);
    }

    // Check: if using GT infrastructure, warn about unsupported locales
    if (
      runtimeUrl === defaultRuntimeApiUrl ||
      (cacheUrl === defaultCacheUrl && loadTranslationsType === 'default')
    ) {
      const warningLocales = (locales || locales).filter(
        (locale) => !getSupportedLocale(locale)
      );
      if (warningLocales.length) {
        console.warn(createUnsupportedLocalesWarning(warningLocales));
      }
    }
  }, [
    process.env.NODE_ENV,
    devApiKey,
    loadTranslationsType,
    cacheUrl,
    runtimeUrl,
    projectId,
    locales,
  ]);

  // ---------- FLAGS ---------- //

  const [translationRequired, dialectTranslationRequired] = useMemo(() => {
    // User locale is not default locale or equivalent
    const translationRequired = requiresTranslation(
      defaultLocale,
      locale,
      locales
    );

    // User locale is not default locale but is a dialect of the same language
    const dialectTranslationRequired =
      translationRequired && isSameLanguage(defaultLocale, locale);

    return [translationRequired, dialectTranslationRequired];
  }, [defaultLocale, locale, locales]);

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

  // Setup runtime translation
  const { registerContentForTranslation, registerJsxForTranslation } =
    useRuntimeTranslation({
      locale,
      versionId: _versionId,
      projectId,
      runtimeTranslationEnabled,
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
        locales,
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
