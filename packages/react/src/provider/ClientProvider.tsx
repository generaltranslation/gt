'use client';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { determineLocale } from 'generaltranslation';
import { GTContext } from './GTContext';
import { ClientProviderProps } from '../types/providers';
import { TranslationsObject } from '../types/types';
import useRuntimeTranslation from '../hooks/internal/useRuntimeTranslation';
import useCreateInternalUseGTFunction from '../hooks/internal/useCreateInternalUseGTFunction';
import useCreateInternalUseDictFunction from '../hooks/internal/useCreateInternalUseDictFunction';
import { defaultLocaleCookieName } from '../utils/cookies';

// meant to be used inside the server-side <GTProvider>
export default function ClientProvider({
  children,
  dictionary,
  initialTranslations,
  dictionaryTranslations,
  locale: _locale,
  _versionId,
  defaultLocale,
  translationRequired,
  dialectTranslationRequired,
  locales = [],
  renderSettings,
  projectId,
  devApiKey,
  runtimeUrl,
  runtimeTranslationEnabled,
  resetLocaleCookieName,
  localeCookieName = defaultLocaleCookieName,
}: ClientProviderProps): React.JSX.Element {
  // ---------- SET UP ---------- //

  // ----- TRANSLATIONS STATE ----- //

  const [translations, setTranslations] = useState<TranslationsObject | null>(
    devApiKey ? null : initialTranslations
  );

  // ----- LOCALE STATE ----- //

  // Maintain the locale state
  const [locale, _setLocale] = useState<string>(
    _locale ? determineLocale(_locale, locales) || '' : ''
  );

  // Monitor for changes in _locale parameter
  useEffect(() => {
    const newLocale = _locale ? determineLocale(_locale, locales) || '' : '';
    if (newLocale !== locale) {
      _setLocale(newLocale);
    }
  }, [_locale, locales]);

  // Check for an invalid cookie
  useEffect(() => {
    const cookieLocale = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${localeCookieName}=`))
      ?.split('=')[1];
    if (locale && cookieLocale && cookieLocale !== locale) {
      document.cookie = `${localeCookieName}=;path=/`;
    }
  }, [locale, localeCookieName]);

  // Set the locale via cookies and refresh the page to reload server-side. Make sure the language is supported.
  const setLocale = (newLocale: string): void => {
    // validate locale
    newLocale = determineLocale(newLocale, locales) || locale || defaultLocale;

    // persist locale
    document.cookie = `${localeCookieName}=${newLocale};path=/`;
    document.cookie = `${resetLocaleCookieName}=true;path=/`;

    // set locale
    _setLocale(newLocale);

    // re-render client components
    window.location.reload();
  };

  // ---------- TRANSLATION LIFECYCLE ---------- //

  // Fetch additional translations and queue them for merging
  useEffect(() => {
    setTranslations((prev) => ({ ...initialTranslations, ...prev }));
  }, [initialTranslations]);

  // ---------- TRANSLATION METHODS ---------- //

  const { registerContentForTranslation, registerJsxForTranslation } =
    useRuntimeTranslation({
      locale: locale,
      versionId: _versionId,
      projectId,
      devApiKey,
      runtimeUrl,
      setTranslations,
      defaultLocale,
      renderSettings,
      runtimeTranslationEnabled,
    });

  // ---------- USE GT() TRANSLATION ---------- //

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

  // ---------- DICTIONARY ENTRY TRANSLATION ---------- //

  const _internalUseDictFunction = useCreateInternalUseDictFunction(
    dictionary,
    translations,
    dictionaryTranslations,
    locale,
    defaultLocale,
    translationRequired,
    dialectTranslationRequired,
    runtimeTranslationEnabled,
    registerContentForTranslation,
    renderSettings
  );

  // ---------- RENDER LOGIC ---------- //

  // Block rendering until all dictionary translations are resolved
  const display = !!(!translationRequired || translations) && locale;

  return (
    <GTContext.Provider
      value={{
        registerContentForTranslation,
        registerJsxForTranslation,
        setLocale,
        _internalUseGTFunction,
        _internalUseDictFunction,
        locale,
        locales,
        defaultLocale,
        translations,
        dictionaryTranslations: dictionaryTranslations,
        translationRequired,
        dialectTranslationRequired,
        renderSettings,
        runtimeTranslationEnabled,
      }}
    >
      {display && children}
    </GTContext.Provider>
  );
}
