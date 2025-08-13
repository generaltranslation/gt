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
import {
  defaultLocaleCookieName,
  defaultRegionCookieName,
} from '../utils/cookies';

// meant to be used inside the server-side <GTProvider>
export default function ClientProvider({
  children,
  dictionary,
  initialTranslations,
  initialTranslationsStatus,
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
  runtimeTranslationEnabled,
  resetLocaleCookieName,
  localeCookieName = defaultLocaleCookieName,
  regionCookieName = defaultRegionCookieName,
  customMapping,
}: ClientProviderProps): React.JSX.Element {
  // ----- TRANSLATIONS STATE ----- //

  const [translations, setTranslations] = useState<Translations | null>(
    devApiKey ? null : initialTranslations
  );

  const [translationsStatus, setTranslationsStatus] =
    useState<TranslationsStatus | null>(
      devApiKey ? null : initialTranslationsStatus
    );

  // ----- LOCALE STATE ----- //

  // Maintain the locale state
  const [locale, _setLocale] = useState<string>(
    _locale ? determineLocale(_locale, locales) || '' : ''
  );

  // Check for an invalid cookie and update it
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

    // re-render server components
    window.location.reload();
  };

  // ----- REGION STATE ----- //

  const [region, _setRegion] = useState(_region);

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

  // Set the region via cookies. No page reload needed.
  const setRegion = (newRegion: string | undefined): void => {
    // persist region
    document.cookie = `${regionCookieName}=${newRegion || ''};path=/`;
    // set region
    _setRegion(newRegion);
  };

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
        region,
        setRegion,
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
