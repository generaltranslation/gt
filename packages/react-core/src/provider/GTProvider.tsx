import { Suspense, useMemo } from 'react';
import { GTContext } from './GTContext';
import {
  defaultCacheUrl,
  defaultRuntimeApiUrl,
  libraryDefaultLocale,
} from 'generaltranslation/internal';
import useRuntimeTranslation from './hooks/useRuntimeTranslation';
import { getDefaultRenderSettings } from '../rendering/getDefaultRenderSettings';
import useCreateInternalUseGTFunction from './hooks/translation/useCreateInternalUseGTFunction';
import useCreateInternalUseTranslationsFunction from './hooks/translation/useCreateInternalUseTranslationsFunction';
import {
  defaultLocaleCookieName,
  defaultRegionCookieName,
  defaultEnableI18nCookieName,
} from '../utils/cookies';
import { InternalGTProviderProps } from '../types-dir/config';
import { useLocaleState } from './hooks/locales/useLocaleState';
import { useErrorChecks } from './hooks/useErrorChecks';
import { resolveAliasLocale } from '@generaltranslation/format';
import { GT } from 'generaltranslation';
import { useLoadDictionary } from './hooks/useLoadDictionary';
import { useLoadTranslations } from './hooks/useLoadTranslations';
import { useEnableI18n as _useEnableI18n } from './hooks/useEnableI18n';
import { useCreateInternalUseTranslationsObjFunction } from './hooks/translation/useCreateInternalUseTranslationsObjFunction';

// Deprecated functions, will be removed in a future version
import { readAuthFromEnv as _readAuthFromEnv } from '../utils/utils';
import { isSSREnabled } from './helpers/isSSREnabled';
import { useDetermineLocale as _useDetermineLocale } from './hooks/locales/useDetermineLocale';
import { useRegionState as _useRegionState } from './hooks/useRegionState';

export function getTranslationRequirements({
  translationRequiredOverride,
  dialectTranslationRequiredOverride,
  localeTranslationRequired,
  localeDialectTranslationRequired,
}: {
  translationRequiredOverride?: boolean;
  dialectTranslationRequiredOverride?: boolean;
  localeTranslationRequired: boolean;
  localeDialectTranslationRequired: boolean;
}) {
  const translationRequired =
    translationRequiredOverride ?? localeTranslationRequired;
  const dialectTranslationRequired = translationRequired
    ? (dialectTranslationRequiredOverride ?? localeDialectTranslationRequired)
    : false;
  return { translationRequired, dialectTranslationRequired };
}

export default function GTProvider({
  children,
  config,
  environment = 'production',
  projectId: _projectId = config?.projectId || '',
  devApiKey: _devApiKey = config?.devApiKey || '',
  _versionId = config?._versionId,
  dictionary: _dictionary,
  dictionaryTranslations: _dictionaryTranslations,
  locales = config?.locales || [],
  defaultLocale = config?.defaultLocale || libraryDefaultLocale,
  cacheUrl = config?.cacheUrl || defaultCacheUrl,
  runtimeUrl = config?.runtimeUrl || defaultRuntimeApiUrl,
  renderSettings = config?.renderSettings ||
    getDefaultRenderSettings(environment),
  ssr = config?.ssr || isSSREnabled(),
  localeCookieName = config?.localeCookieName || defaultLocaleCookieName,
  regionCookieName = defaultRegionCookieName,
  locale: _locale = '',
  region: _region,
  loadDictionary,
  loadTranslations,
  fallback = undefined,
  translations: _translations = null,
  translationRequired: translationRequiredOverride,
  dialectTranslationRequired: dialectTranslationRequiredOverride,
  customMapping = config?.customMapping,
  enableI18n: _enableI18n = config?.enableI18n !== undefined
    ? config.enableI18n
    : true,
  enableI18nLoaded,
  reloadOnLocaleUpdate,
  onLocaleUpdate,
  developmentApiEnabled: developmentApiEnabledOverride,
  useEnableI18n = _useEnableI18n,
  readAuthFromEnv = _readAuthFromEnv,
  useDetermineLocale = _useDetermineLocale,
  useRegionState = _useRegionState,
  ...metadata
}: InternalGTProviderProps) {
  // ---------- PROPS ---------- //
  if (_locale) {
    _locale = resolveAliasLocale(_locale, customMapping);
  }

  // Read env to get projectId and API key
  const { projectId, devApiKey } = readAuthFromEnv({
    projectId: _projectId,
    devApiKey: _devApiKey,
  });

  // Enable I18n feature flags
  const { enableI18n } = useEnableI18n({
    enableI18n: _enableI18n,
    enableI18nLoaded,
    enableI18nCookieName: defaultEnableI18nCookieName,
    ssr,
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
    translationRequired: localeTranslationRequired,
    dialectTranslationRequired: localeDialectTranslationRequired,
  } = useLocaleState({
    _locale,
    defaultLocale,
    locales,
    ssr,
    localeCookieName,
    customMapping,
    useDetermineLocale,
    enableI18n,
    reloadOnLocaleUpdate,
    onLocaleUpdate,
  });
  const { translationRequired, dialectTranslationRequired } =
    getTranslationRequirements({
      translationRequiredOverride,
      dialectTranslationRequiredOverride,
      localeTranslationRequired,
      localeDialectTranslationRequired,
    });

  // Define the region instance
  const { region, setRegion } = useRegionState({
    _region,
    ssr,
    regionCookieName,
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
        baseUrl: runtimeUrl || undefined,
        customMapping,
      }),
    [devApiKey, defaultLocale, locale, projectId, runtimeUrl, customMapping]
  );

  // Determine the type of translation loading
  // custom - custom loading function provided
  // default - using GT provided cache
  // disabled - no translation loading
  const loadTranslationsType = useMemo(() => {
    return (
      (loadTranslations && 'custom') ||
      (cacheUrl && projectId && 'default') ||
      'disabled'
    );
  }, [loadTranslations, cacheUrl, projectId]);

  // ---------- LOAD DICTIONARY ---------- //
  const dictionaryInput = useMemo(() => _dictionary ?? {}, [_dictionary]);
  const dictionaryTranslationsInput = useMemo(
    () => _dictionaryTranslations ?? {},
    [_dictionaryTranslations]
  );

  const {
    dictionary,
    setDictionary,
    dictionaryTranslations,
    setDictionaryTranslations,
  } = useLoadDictionary({
    _dictionary: dictionaryInput,
    _dictionaryTranslations: dictionaryTranslationsInput,
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
    environment,
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
    developmentApiEnabled: runtimeDevelopmentApiEnabled,
  } = useRuntimeTranslation({
    gt,
    locale,
    versionId: _versionId,
    defaultLocale,
    runtimeUrl,
    renderSettings,
    setTranslations,
    environment,
    ...metadata,
  });

  const developmentApiEnabled =
    developmentApiEnabledOverride ?? runtimeDevelopmentApiEnabled;

  // ---------- USE GT ---------- //

  const {
    _gtFunction,
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
    environment,
  });

  // ---------- USE DICT ---------- //

  const _dictionaryFunction = useCreateInternalUseTranslationsFunction(
    gt,
    dictionary,
    dictionaryTranslations,
    translations,
    locale,
    defaultLocale,
    translationRequired,
    dialectTranslationRequired,
    developmentApiEnabled,
    registerIcuForTranslation,
    environment
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
        _gtFunction,
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
        _versionId,
      }}
    >
      <Suspense fallback={fallback}>{display ? children : fallback}</Suspense>
    </GTContext.Provider>
  );
}
