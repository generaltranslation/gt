'use client';
import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { determineLocale, GT } from 'generaltranslation';
import { GTContext } from './GTContext';
import { ClientProviderProps } from '../types/config';
import { TranslationsStatus, Translations } from '../types/types';
import useRuntimeTranslation from './hooks/useRuntimeTranslation';
import useCreateInternalUseGTFunction from './hooks/useCreateInternalUseGTFunction';
import useCreateInternalUseTranslationsFunction from './hooks/useCreateInternalUseTranslationsFunction';
import { defaultLocaleCookieName } from '../utils/cookies';
// meant to be used inside the server-side <GTProvider>
export default function ClientProvider({
  children,
  dictionary,
  initialTranslations,
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
  customMapping,
}: ClientProviderProps): React.JSX.Element {
  // ---------- SET UP ---------- //

  // Define the GT instance
  // Used for custom mapping and as a driver for the runtime translation
  const gt = useMemo(
    () =>
      new GT({
        devApiKey,
        sourceLocale: defaultLocale,
        projectId,
        baseUrl: runtimeUrl || undefined,
        customMapping,
      }),
    [devApiKey, defaultLocale, projectId, runtimeUrl, customMapping]
  );

  // ----- TRANSLATIONS STATE ----- //

  const [translations, setTranslations] = useState<Translations | null>(
    devApiKey ? null : initialTranslations
  );

  const [translationsStatus, setTranslationsStatus] =
    useState<TranslationsStatus | null>(null);

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
    setTranslationsStatus((prev) => ({
      ...Object.keys(initialTranslations).reduce(
        (acc: TranslationsStatus, hash) => {
          acc[hash] = {
            status: 'success',
          };
          return acc;
        },
        {}
      ),
      ...prev,
    }));
  }, [initialTranslations]);

  // ---------- TRANSLATION METHODS ---------- //

  const {
    registerIcuForTranslation,
    registerJsxForTranslation,
    registerI18nextForTranslation,
  } = useRuntimeTranslation({
    gt,
    locale: locale,
    versionId: _versionId,
    projectId,
    devApiKey,
    runtimeUrl,
    setTranslations,
    setTranslationsStatus,
    defaultLocale,
    renderSettings,
    runtimeTranslationEnabled,
  });

  // ---------- USE GT() TRANSLATION ---------- //

  const _internalUseGTFunction = useCreateInternalUseGTFunction(
    translations,
    translationsStatus,
    locale,
    defaultLocale,
    translationRequired,
    dialectTranslationRequired,
    runtimeTranslationEnabled,
    registerIcuForTranslation,
    renderSettings
  );

  // ---------- DICTIONARY ENTRY TRANSLATION ---------- //

  const _internalUseTranslationsFunction =
    useCreateInternalUseTranslationsFunction(
      dictionary,
      translations,
      translationsStatus,
      locale,
      defaultLocale,
      translationRequired,
      dialectTranslationRequired,
      runtimeTranslationEnabled,
      registerIcuForTranslation,
      renderSettings
    );

  // ---------- RENDER LOGIC ---------- //

  // Block rendering until all translations are resolved (IF YOU REMOVE THIS YOU WILL BE FIRED)
  const display = !!(!translationRequired || translations) && locale;

  return (
    <GTContext.Provider
      value={{
        gt,
        registerIcuForTranslation,
        registerI18nextForTranslation,
        registerJsxForTranslation,
        setLocale,
        _internalUseGTFunction,
        _internalUseTranslationsFunction,
        locale,
        locales,
        defaultLocale,
        translations,
        translationsStatus: translationsStatus,
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
