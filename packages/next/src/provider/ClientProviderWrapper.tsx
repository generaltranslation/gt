'use client';
import { GTProvider, setReactI18nManager } from 'gt-react/context';
import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { I18nManager } from 'gt-i18n/internal';
import type { Hash, Locale } from 'gt-i18n/internal/types';
import type { Dictionary, Translation } from 'gt-i18n/types';
import type { CustomMapping } from '@generaltranslation/format/types';
import { standardizeLocale } from '@generaltranslation/format';

type ClientRenderSettings = {
  timeout?: number;
};

type ClientProviderWrapperProps = {
  children: ReactNode;
  dictionary: LegacyDictionary;
  dictionaryTranslations: LegacyDictionary;
  translations: LegacyTranslations;
  locale: string;
  locales: string[];
  _versionId?: string;
  defaultLocale: string;
  translationEnabled: boolean;
  renderSettings: ClientRenderSettings;
  projectId?: string;
  devApiKey?: string;
  runtimeUrl?: string | null;
  gtServicesEnabled?: boolean;
  localeCookieName: string;
  resetLocaleCookieName: string;
  customMapping?: CustomMapping;
  environment: 'development' | 'production' | 'test';
  localeRoutingEnabledCookieName: string;
  referrerLocaleCookieName: string;
};

type LegacyDictionaryEntry =
  | string
  | [string]
  | [string, Record<string, unknown>];
type LegacyDictionary =
  | {
      [key: string]: LegacyDictionary | LegacyDictionaryEntry;
    }
  | (LegacyDictionary | LegacyDictionaryEntry)[];
type LegacyTranslations = Record<Hash, Translation | null>;

function extractLocale(
  pathname: string,
  gt: { resolveAliasLocale: (locale: string) => string }
): string | null {
  const matches = pathname.match(/^\/([^/]+)(?:\/|$)/);
  return matches ? gt.resolveAliasLocale(matches[1]) : null;
}

export function ClientProviderWrapper(props: ClientProviderWrapperProps) {
  const router = useRouter();
  const {
    children,
    dictionary,
    dictionaryTranslations,
    translations,
    locale,
    locales,
    defaultLocale,
    gtServicesEnabled,
    referrerLocaleCookieName,
    localeRoutingEnabledCookieName,
    devApiKey,
    projectId,
    runtimeUrl,
    customMapping,
    localeCookieName,
    resetLocaleCookieName,
    translationEnabled,
    renderSettings,
    environment,
    _versionId,
  } = props;

  const translationsSnapshot = useMemo(
    () => ({ [locale]: normalizeTranslations(translations) }),
    [locale, translations]
  );
  const dictionarySnapshot = useMemo(
    () => {
      const dictionaries = {
        [defaultLocale]: dictionary as Dictionary,
      } as Record<Locale, Dictionary>;
      if (locale !== defaultLocale) {
        dictionaries[locale] = dictionaryTranslations as Dictionary;
      }
      return dictionaries;
    },
    [defaultLocale, dictionary, dictionaryTranslations, locale]
  );

  const i18nManager = useMemo(
    () =>
      new I18nManager<Translation>({
        defaultLocale,
        locales,
        customMapping,
        projectId,
        devApiKey,
        runtimeUrl,
        _versionId,
        enableI18n: translationEnabled,
        environment:
          environment === 'development' ? 'development' : 'production',
        dictionary: dictionary as Dictionary,
        runtimeTranslation: {
          timeout: renderSettings.timeout,
          metadata: {
            sourceLocale: defaultLocale,
            ...(renderSettings.timeout && {
              timeout: renderSettings.timeout,
            }),
            projectId,
            publish: true,
            fast: true,
          },
        },
        lifecycle: {
          onTranslationsCacheMiss({ locale, translation, hash }) {
            translationsSnapshot[locale] ||= {};
            translationsSnapshot[locale][hash] = translation;
          },
        },
      }),
    [
      customMapping,
      defaultLocale,
      devApiKey,
      dictionary,
      environment,
      locales,
      projectId,
      renderSettings.timeout,
      runtimeUrl,
      translationEnabled,
      translationsSnapshot,
      _versionId,
    ]
  );
  i18nManager.updateTranslations(translationsSnapshot);
  i18nManager.updateDictionaries(dictionarySnapshot);
  setReactI18nManager(i18nManager);

  /**
   * Reloads server components
   * Must pass as a callback so the refresh function does not lose access to the router instance
   */
  const reloadLocale = useCallback(
    (nextLocale: string) => {
      document.cookie = `${localeCookieName}=${nextLocale};path=/`;
      document.cookie = `${resetLocaleCookieName}=true;path=/`;
      document.cookie = `${referrerLocaleCookieName}=${nextLocale};path=/`;
      router.refresh();
    },
    [localeCookieName, referrerLocaleCookieName, resetLocaleCookieName, router]
  );

  const gt = useMemo(
    () => i18nManager.getGTClass(locale),
    [i18nManager, locale]
  );

  const pathname = usePathname();
  useEffect(() => {
    // ----- Referrer Locale ----- //
    if (locale) {
      document.cookie = `${referrerLocaleCookieName}=${gt.resolveAliasLocale(locale)};path=/`;
    }

    // ----- Middleware Locale Routing ----- //
    const middlewareEnabled =
      document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${localeRoutingEnabledCookieName}=`))
        ?.split('=')[1] === 'true';
    if (middlewareEnabled) {
      const extractedLocale = extractLocale(pathname, gt) || defaultLocale;
      let pathLocale = gt.determineLocale(
        [
          gtServicesEnabled
            ? standardizeLocale(extractedLocale)
            : extractedLocale,
          defaultLocale,
        ],
        locales
      );
      if (pathLocale) {
        pathLocale = gt.resolveAliasLocale(pathLocale);
      }

      if (pathLocale && locales.includes(pathLocale) && pathLocale !== locale) {
        // Clear the middleware marker before refreshing to avoid a refresh loop.
        document.cookie = `${localeRoutingEnabledCookieName}=;path=/`;

        // Refresh Server Components when the URL locale and provider locale diverge.
        router.refresh();
      }
    }
  }, [
    pathname,
    locale,
    locales,
    defaultLocale,
    gtServicesEnabled,
    referrerLocaleCookieName,
    localeRoutingEnabledCookieName,
    router,
    gt,
  ]);

  return (
    <GTProvider
      dictionary={dictionarySnapshot}
      translations={translationsSnapshot}
      locale={locale}
      locales={locales}
      defaultLocale={defaultLocale}
      customMapping={customMapping}
      enableI18n={translationEnabled}
      localeCookieName={localeCookieName}
      reloadLocale={reloadLocale}
    >
      {children}
    </GTProvider>
  );
}

function normalizeTranslations(
  translations: LegacyTranslations
): Record<Hash, Translation> {
  return Object.fromEntries(
    Object.entries(translations).filter(
      (entry): entry is [Hash, Translation] => entry[1] != null
    )
  );
}
