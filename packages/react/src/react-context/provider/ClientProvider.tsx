'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import { determineLocale } from '@generaltranslation/format';
import { GT } from 'generaltranslation';
import {
  defaultLocaleCookieName,
  defaultRegionCookieName,
} from '@generaltranslation/react-core/internal';
import {
  GTContext,
  useRuntimeTranslation,
  useCreateInternalUseGTFunction,
  useCreateInternalUseTranslationsFunction,
  useCreateInternalUseTranslationsObjFunction,
} from '@generaltranslation/react-core';
import type {
  Dictionary,
  Translations,
} from '@generaltranslation/react-core/types';
import type { ClientProviderProps } from '../types/config';
import { getCookieValue, setCookieValue } from '../../shared/cookies';

// meant to be used inside the server-side <GTProvider>
export function ClientProvider({
  children,
  dictionary: _dictionary,
  dictionaryTranslations: _dictionaryTranslations,
  translations: _translations,
  locale: _locale,
  region: _region,
  _versionId,
  defaultLocale,
  translationRequired,
  dialectTranslationRequired,
  locales = [],
  renderSettings,
  projectId,
  devApiKey,
  runtimeUrl,
  developmentApiEnabled,
  resetLocaleCookieName,
  localeCookieName = defaultLocaleCookieName,
  regionCookieName = defaultRegionCookieName,
  customMapping,
  environment,
  reloadServer,
}: ClientProviderProps): JSX.Element {
  const didMount = useRef(false);
  // ----- TRANSLATIONS STATE ----- //

  const [translations, setTranslations] = useState<Translations | null>(
    _translations // likely to induce hydration error
  );

  // Update the translations object when _translations changes
  useEffect(() => {
    // Skip on mount to avoid an extra set state after first render
    if (!didMount.current) return;
    // Translations must override to avoid situation where we maintain stale dev translations from other languages
    // for example { abc123: '你好!', def456: 'bonjour' }
    setTranslations(_translations);
  }, [_translations]);

  // ----- LOCALE STATE ----- //

  // Maintain the locale state
  const [locale, _setLocale] = useState<string>(
    _locale ? determineLocale(_locale, locales, customMapping) || '' : ''
  );

  // Check for an invalid cookie and update it
  useEffect(() => {
    let cookieLocale = getCookieValue(localeCookieName);
    if (cookieLocale) {
      cookieLocale = gt.resolveAliasLocale(cookieLocale);
    }
    if (locale && cookieLocale && cookieLocale !== locale) {
      setCookieValue(localeCookieName, '');
    }
  }, [locale, localeCookieName]);

  // ----- DICTIONARY TRANSLATIONS STATE ----- //

  const [dictionaryTranslations, setDictionaryTranslations] =
    useState<Dictionary>(_dictionaryTranslations || {});
  const [dictionary, setDictionary] = useState<Dictionary>(_dictionary || {});

  // Update the dictionary translations when locale changes (see useEffect for translations above)
  useEffect(() => {
    if (!didMount.current) return;
    setDictionaryTranslations(_dictionaryTranslations);
    setDictionary(_dictionary);
  }, [_dictionaryTranslations, _dictionary]);

  // ----- REGION STATE ----- //

  // Set region state
  const [region, _setRegion] = useState(_region);

  // Set the region via cookies. No page reload needed.
  const setRegion = (newRegion: string | undefined) => {
    // persist region
    setCookieValue(regionCookieName, newRegion || '');
    // set region
    _setRegion(newRegion);
  };

  // Check for an invalid cookie and update it
  useEffect(() => {
    const cookieRegion = getCookieValue(regionCookieName);
    if (region && cookieRegion && cookieRegion !== region) {
      setCookieValue(regionCookieName, '');
    }
  }, [region, regionCookieName]);

  // ----- GT SETUP ----- //

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

  // Set the locale via cookies and refresh the page to reload server-side. Make sure the language is supported.
  const setLocale = (newLocale: string) => {
    // validate locale
    newLocale =
      determineLocale(newLocale, locales, customMapping) ||
      locale ||
      defaultLocale;
    newLocale = gt.resolveAliasLocale(newLocale);
    // persist locale
    setCookieValue(localeCookieName, newLocale);
    setCookieValue(resetLocaleCookieName, 'true');
    // set locale
    _setLocale(newLocale);
    // re-render server components
    reloadServer();
  };

  // ---------- TRANSLATION METHODS ---------- //

  const { registerIcuForTranslation, registerJsxForTranslation } =
    useRuntimeTranslation({
      gt,
      locale: locale,
      versionId: _versionId,
      runtimeUrl,
      setTranslations,
      defaultLocale,
      renderSettings,
      developmentApiEnabled,
      environment,
    });

  // ---------- USE GT() TRANSLATION ---------- //

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

  // ---------- DICTIONARY FUNCTIONS ---------- //

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
    dictionary,
    dictionaryTranslations,
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

  // ---------- RENDER LOGIC ---------- //

  // Block rendering until all translations are resolved (IF YOU REMOVE THIS YOU WILL BE FIRED)
  const display = !!(!translationRequired || translations) && locale;

  // Update didMount ref
  useEffect(() => {
    didMount.current = true;
  }, []);

  return (
    <GTContext.Provider
      value={{
        gt,
        registerIcuForTranslation,
        registerJsxForTranslation,
        setLocale,
        _gtFunction,
        _mFunction,
        _filterMessagesForPreload,
        _preloadMessages,
        _dictionaryFunction,
        _dictionaryObjFunction,
        locale,
        locales,
        defaultLocale,
        region,
        setRegion,
        translations,
        translationRequired,
        dialectTranslationRequired,
        renderSettings,
        developmentApiEnabled,
        _versionId,
      }}
    >
      <Suspense fallback={display && children}>{display && children}</Suspense>
    </GTContext.Provider>
  );
}
