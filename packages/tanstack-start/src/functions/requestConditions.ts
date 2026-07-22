import { setCookie } from '@tanstack/react-start/server';
import { getI18nConfig } from '@generaltranslation/react-core/pure';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import { getCookieValue, parseAcceptLanguage } from 'gt-i18n/internal';
import type { RequestConditions } from '../condition-store/AsyncLocalConditionStore';
import type { InitializeGTParams } from '../types';
import { getLocaleFromPath } from './localeRouting';

export const localeCookieOptions = {
  path: '/',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 365,
};

const noLocaleCandidatesWarning = createDiagnosticMessage({
  source: 'gt-tanstack-start',
  severity: 'Warning',
  whatHappened: 'No locale preference was found for the current request',
  reassurance: 'GT will use the configured default locale',
  why: 'neither the locale cookie nor the Accept-Language header supplied a supported locale candidate',
});

export function resolveRequestConditions(
  request: Request,
  localeConfig?: InitializeGTParams
): RequestConditions {
  const i18nConfig = getI18nConfig();
  const cookieHeader = request.headers.get('cookie');
  const localeCandidates: string[] = [];
  if (localeConfig?.localeRouting) {
    const pathLocale = getLocaleFromPath(new URL(request.url).pathname);
    if (pathLocale) localeCandidates.push(pathLocale);
  }
  const cookieLocale = getCookieValue(
    cookieHeader,
    i18nConfig.getLocaleCookieName()
  );
  if (cookieLocale) localeCandidates.push(cookieLocale);
  localeCandidates.push(
    ...parseAcceptLanguage(request.headers.get('accept-language'))
  );

  if (localeCandidates.length === 0) {
    console.warn(noLocaleCandidatesWarning);
  }

  const locale = i18nConfig.resolveSupportedLocale(
    localeCandidates,
    localeConfig ?? {
      defaultLocale: i18nConfig.getDefaultLocale(),
      locales: i18nConfig.getLocales(),
      customMapping: i18nConfig.getCustomMapping(),
    }
  );

  setCookie(i18nConfig.getLocaleCookieName(), locale, localeCookieOptions);

  const enableI18nCookie = getCookieValue(
    cookieHeader,
    i18nConfig.getEnableI18nCookieName()
  );

  return {
    locale,
    region:
      getCookieValue(cookieHeader, i18nConfig.getRegionCookieName()) ||
      undefined,
    enableI18n:
      enableI18nCookie === undefined ? true : enableI18nCookie === 'true',
  };
}
