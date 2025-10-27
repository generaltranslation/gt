import { createIsomorphicFn } from '@tanstack/react-start';
import { getCookie, getRequestHeader } from '@tanstack/react-start/server';
import { determineLocale, resolveAliasLocale } from 'generaltranslation';
const localeCookieName = 'generaltranslation.locale';
const defaultLocale = 'en';
const locales = ['en', 'fr', 'zh'];

function getRuntime(): string {
  return typeof window !== 'undefined' ? 'client' : 'server';
}

function getLocaleClient(): string {
  // Check for locale in cookie
  let cookieLocale =
    typeof document !== 'undefined'
      ? document.cookie
          .split('; ')
          .find((row) => row.startsWith(`${localeCookieName}=`))
          ?.split('=')[1]
      : undefined;
  if (cookieLocale) {
    cookieLocale = resolveAliasLocale(cookieLocale);
  }

  // check user's configured locales
  let browserLocales = (() => {
    if (typeof navigator === 'undefined') {
      return [defaultLocale];
    }
    if (navigator?.languages) return navigator.languages;
    if (navigator?.language) return [navigator.language];
    if ((navigator as any)?.userLanguage) {
      return [(navigator as any)?.userLanguage];
    }
    return [defaultLocale];
  })() as string[];
  browserLocales = browserLocales.map((locale) => resolveAliasLocale(locale));

  // determine locale
  let newLocale =
    determineLocale(
      [
        ...(cookieLocale ? [cookieLocale] : []), // then prefer cookie locale
        ...browserLocales, // then prefer browser locale
      ],
      locales
    ) || defaultLocale;
  if (newLocale) {
    newLocale = resolveAliasLocale(newLocale);
  }
  console.log('[GT-TANSTACK-START] getLocaleClient', newLocale, getRuntime());
  return newLocale;
}

function getLocaleServer(): string {
  const preferredLocales: string[] = [];

  // check cookie
  const cookieLocale = getCookie(localeCookieName);
  if (cookieLocale) {
    preferredLocales.push(resolveAliasLocale(cookieLocale));
  }

  // add headers
  preferredLocales.push(
    ...((
      getRequestHeader('accept-language')
        ?.split(',')
        ?.map((locale: string) => locale.split(';')?.[0].trim()) || []
    )?.map((locale: string) => resolveAliasLocale(locale)) || [])
  );

  const newLocale =
    determineLocale(
      [
        ...(preferredLocales ? preferredLocales : []), // then prefer cookie locale
      ],
      locales
    ) || defaultLocale;
  console.log('[GT-TANSTACK-START] getLocaleServer', newLocale, getRuntime());
  return newLocale;
}

export const getLocale = createIsomorphicFn()
  .server(() => getLocaleServer())
  .client(() => getLocaleClient());
