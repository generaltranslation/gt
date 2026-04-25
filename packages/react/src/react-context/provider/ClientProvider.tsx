'use client';

import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { determineLocale, GTFormatter } from 'generaltranslation/format';
import { useTranslateMany } from './hooks/useTranslateMany';
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
  reloadServer,
}: ClientProviderProps): React.JSX.Element {
  const didMount = useRef(false);
  // ----- TRANSLATIONS STATE ----- //

  const [translations, setTranslations] = useState<Translations | null>(
    // devApiKey ? null : _translations
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

  // Update the dictionary translations when locale changes (see useEffect for _translations above)
  useEffect(() => {
    if (!didMount.current) return;
    setDictionaryTranslations(_dictionaryTranslations);
  }, [_dictionaryTranslations]);

  useEffect(() => {
    if (!didMount.current) return;
    setDictionary(_dictionary);
  }, [_dictionary]);

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

  // Define the GTFormatter instance
  // Used for custom mapping and locale resolution
  const gt = useMemo(
    () =>
      new GTFormatter({
        sourceLocale: defaultLocale,
        targetLocale: locale,
        customMapping,
      }),
    [defaultLocale, locale, customMapping]
  );

  const translateMany = useTranslateMany({
    devApiKey,
    defaultLocale,
    projectId,
    runtimeUrl,
    customMapping,
    environment,
  });

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
    reloadServer();
  };

  // ---------- TRANSLATION METHODS ---------- //

  const { registerIcuForTranslation, registerJsxForTranslation } =
    useRuntimeTranslation({
      translateMany,
      projectId,
      devApiKey,
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
      <React.Suspense fallback={display && children}>
        {display && children}
      </React.Suspense>
    </GTContext.Provider>
  );
}
