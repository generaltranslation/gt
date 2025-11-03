'use client';

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { determineLocale, GT } from 'generaltranslation';
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
import { Dictionary, Translations } from '@generaltranslation/react-core/types';
import { ClientProviderProps } from '../types/config';

// meant to be used inside the server-side <GTProvider>
export default function ClientProvider({
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
}: ClientProviderProps): React.JSX.Element {
  // ----- TRANSLATIONS STATE ----- //

  const [translations, setTranslations] = useState<Translations | null>(
    // devApiKey ? null : _translations
    _translations // likely to induce hydration error
  );

  // ----- LOCALE STATE ----- //

  // Maintain the locale state
  const [locale, _setLocale] = useState<string>(
    _locale ? determineLocale(_locale, locales, customMapping) || '' : ''
  );

  // Check for an invalid cookie and update it
  useEffect(() => {
    let cookieLocale = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${localeCookieName}=`))
      ?.split('=')[1];
    if (cookieLocale) {
      cookieLocale = gt.resolveAliasLocale(cookieLocale);
    }
    if (locale && cookieLocale && cookieLocale !== locale) {
      document.cookie = `${localeCookieName}=;path=/`;
    }
  }, [locale, localeCookieName]);

  // ----- DICTIONARY TRANSLATIONS STATE ----- //

  const [dictionaryTranslations, setDictionaryTranslations] =
    useState<Dictionary>(_dictionaryTranslations || {});
  const [dictionary, setDictionary] = useState<Dictionary>(_dictionary || {});

  // ----- REGION STATE ----- //

  // Set region state
  const [region, _setRegion] = useState(_region);

  // Set the region via cookies. No page reload needed.
  const setRegion = (newRegion: string | undefined): void => {
    // persist region
    document.cookie = `${regionCookieName}=${newRegion || ''};path=/`;
    // set region
    _setRegion(newRegion);
  };

  // Check for an invalid cookie and update it
  useEffect(() => {
    const cookieRegion = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${regionCookieName}=`))
      ?.split('=')[1];
    if (region && cookieRegion && cookieRegion !== region) {
      document.cookie = `${regionCookieName}=;path=/`;
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
  const setLocale = (newLocale: string): void => {
    // validate locale
    newLocale =
      determineLocale(newLocale, locales, customMapping) ||
      locale ||
      defaultLocale;
    newLocale = gt.resolveAliasLocale(newLocale);
    // persist locale
    document.cookie = `${localeCookieName}=${newLocale};path=/`;
    document.cookie = `${resetLocaleCookieName}=true;path=/`;
    // set locale
    _setLocale(newLocale);
    // re-render server components
    window.location.reload();
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
    environment,
  });

  // ---------- DICTIONARY FUNCTIONS ---------- //

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

  return (
    <GTContext.Provider
      value={{
        gt,
        registerIcuForTranslation,
        registerJsxForTranslation,
        setLocale,
        _tFunction,
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
      }}
    >
      <React.Suspense fallback={display && children}>
        {display && children}
      </React.Suspense>
    </GTContext.Provider>
  );
}
